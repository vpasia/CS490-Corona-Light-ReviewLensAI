// Offline Firestore double: serialized transactions, staged atomic writes, read-before-write enforcement.
export function memoryDb(seed = {}) {
    const maps = new Map(
        Object.entries(seed).map(([name, docs]) => [
            name,
            new Map(Object.entries(docs)),
        ])
    );
    let sequence = 0,
        queue = Promise.resolve();
    const controls = {
        failCommit: null,
        failBatch: false,
        loseSuccessAck: false,
    };
    const map = (name) => {
        if (!maps.has(name)) maps.set(name, new Map());
        return maps.get(name);
    };
    const copy = (value) =>
        value === undefined ? undefined : structuredClone(value);
    function snapshot(ref) {
        return {
            id: ref.id,
            ref,
            exists: map(ref.name).has(ref.id),
            data: () => copy(map(ref.name).get(ref.id)),
        };
    }
    function query(name, filters = [], max = Infinity) {
        const q = {
            name,
            filters,
            max,
            where: (key, op, value) => {
                if (op !== '==') throw new Error('Unsupported query');
                return query(name, [...filters, [key, value]], max);
            },
            limit: (n) => query(name, filters, n),
            async get() {
                return {
                    docs: [...map(name)]
                        .filter(([, value]) =>
                            filters.every(([k, v]) => value[k] === v)
                        )
                        .slice(0, max)
                        .map(([id]) => snapshot(ref(name, id))),
                };
            },
        };
        return q;
    }
    function ref(name, id = `auto-${++sequence}`) {
        const r = {
            name,
            id,
            path: `${name}/${id}`,
            get: async () => snapshot(r),
            set: async (data, options) => apply([['set', r, data, options]]),
            update: async (data) => apply([['update', r, data]]),
            delete: async () => apply([['delete', r]]),
        };
        return r;
    }
    function apply(writes) {
        for (const [op, r, data, options] of writes) {
            if (op === 'delete') {
                map(r.name).delete(r.id);
                continue;
            }
            if (op === 'update' && !map(r.name).has(r.id))
                throw new Error('Update missing document');
            const value =
                op === 'update' || options?.merge
                    ? { ...copy(map(r.name).get(r.id)), ...copy(data) }
                    : copy(data);
            for (const key of Object.keys(value))
                if (value[key] === 'DELETE_FIELD') delete value[key];
            map(r.name).set(r.id, value);
        }
    }
    const db = {
        controls,
        maps,
        data: (name, id) => copy(map(name).get(id)),
        docs: (name) => [...map(name).values()].map(copy),
        collection: (name) => ({ ...query(name), doc: (id) => ref(name, id) }),
        batch() {
            const writes = [];
            return {
                delete: (r) => writes.push(['delete', r]),
                set: (r, d, o) => writes.push(['set', r, d, o]),
                async commit() {
                    if (controls.failBatch)
                        throw new Error('Batch unavailable');
                    apply(writes);
                },
            };
        },
        runTransaction(callback) {
            const pending = queue.then(async () => {
                const writes = [];
                const tx = {
                    async get(r) {
                        if (writes.length) throw new Error('Read after write');
                        return r.filters ? r.get() : snapshot(r);
                    },
                    set: (r, d, o) => writes.push(['set', r, d, o]),
                    update: (r, d) => writes.push(['update', r, d]),
                    delete: (r) => writes.push(['delete', r]),
                };
                const result = await callback(tx);
                if (controls.failCommit?.(writes))
                    throw new Error('Commit unavailable');
                apply(writes);
                if (
                    controls.loseSuccessAck &&
                    writes.some(
                        ([, r, d]) =>
                            r.name === 'ingestionRuns' &&
                            d?.status === 'succeeded'
                    )
                ) {
                    controls.loseSuccessAck = false;
                    throw new Error('Lost acknowledgement');
                }
                return result;
            });
            queue = pending.catch(() => {});
            return pending;
        },
    };
    return db;
}
