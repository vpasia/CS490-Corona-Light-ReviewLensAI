import {
    jest,
    describe,
    it,
    expect,
    beforeEach,
    afterEach,
} from '@jest/globals';

jest.unstable_mockModule('../../src/config/firebaseAdmin.js', () => ({
    getDb: jest.fn(() => {
        throw new Error('Unexpected live access');
    }),
}));
jest.unstable_mockModule('firebase-admin/firestore', () => ({
    FieldValue: {
        serverTimestamp: () => 'SERVER_TIME',
        delete: () => 'DELETE_FIELD',
    },
}));
const { importReviews, getIngestionRun, getIngestionRuns } =
    await import('../../src/services/ingestionService.js');
const url = 'https://www.amazon.com/dp/B07PRVS98X';
const valid = {
    text: ' Actual review ',
    rating: '5',
    sourceReviewId: 'R1',
    userId: 'forged',
};

function fakeDb() {
    const collections = {
        products: new Map([
            ['A', { userId: 'user-A', amazonUrl: url }],
            ['A2', { userId: 'user-A', amazonUrl: url }],
            ['B', { userId: 'user-B', amazonUrl: url }],
        ]),
        reviews: new Map(),
        ingestionRuns: new Map(),
    };
    let seq = 0;
    let queue = Promise.resolve();
    const state = {
        failSuccess: false,
        failFailure: false,
        loseSuccessAck: false,
    };
    function snapshot(map, id) {
        return { exists: map.has(id), data: () => map.get(id) };
    }
    const db = {
        collection(name) {
            function query(filters = []) {
                return {
                    where(field, _operator, value) {
                        return query([...filters, [field, value]]);
                    },
                    async get() {
                        return {
                            docs: [...collections[name].entries()]
                                .filter(([, v]) =>
                                    filters.every(([f, x]) => v[f] === x)
                                )
                                .map(([id, v]) => ({ id, data: () => v })),
                        };
                    },
                };
            }
            return {
                ...query(),
                doc(id = `id-${++seq}`) {
                    return {
                        id,
                        collectionName: name,
                        async get() {
                            return snapshot(collections[name], id);
                        },
                    };
                },
            };
        },
        runTransaction(callback) {
            const result = queue.then(async () => {
                const changes = [];
                const tx = {
                    async get(ref) {
                        if (changes.length) throw new Error('Read after write');
                        return snapshot(
                            collections[ref.collectionName],
                            ref.id
                        );
                    },
                    set(ref, value) {
                        changes.push([ref, value, false]);
                    },
                    update(ref, value) {
                        changes.push([ref, value, true]);
                    },
                };
                const output = await callback(tx);
                if (
                    state.failSuccess &&
                    changes.some(([, v]) => v.status === 'succeeded')
                )
                    throw new Error('secret write failure');
                if (
                    state.failFailure &&
                    changes.some(([, v]) => v.status === 'failed')
                )
                    throw new Error('secret status failure');
                for (const [ref, value, update] of changes) {
                    const map = collections[ref.collectionName];
                    if (update && !map.has(ref.id))
                        throw new Error('Missing update target');
                    const next = {
                        ...(update ? map.get(ref.id) : {}),
                        ...value,
                    };
                    for (const key of Object.keys(next))
                        if (next[key] === 'DELETE_FIELD') delete next[key];
                    map.set(ref.id, next);
                }
                if (
                    state.loseSuccessAck &&
                    changes.some(([, v]) => v.status === 'succeeded')
                ) {
                    state.loseSuccessAck = false;
                    throw new Error('Lost commit acknowledgement');
                }
                return output;
            });
            queue = result.catch(() => {});
            return result;
        },
    };
    return { db, collections, state };
}
let log;
beforeEach(() => {
    log = jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
    log.mockRestore();
});

describe('owned ingestion coordination and result state', () => {
    it('runs source retrieval, normalization, atomic persistence and success tracking', async () => {
        const { db, collections } = fakeDb();
        const fetchReviews = jest.fn(async (source) => {
            expect(source).toBe(url);
            expect([...collections.ingestionRuns.values()][0].status).toBe(
                'processing'
            );
            return [valid, { text: '', rating: 1 }];
        });
        const result = await importReviews('user-A', 'A', { db, fetchReviews });
        expect(result).toMatchObject({
            status: 'succeeded',
            receivedCount: 2,
            acceptedCount: 1,
            rejectedCount: 1,
            savedCount: 1,
        });
        expect(fetchReviews).toHaveBeenCalledTimes(1);
        expect([...collections.reviews.values()][0]).toMatchObject({
            text: 'Actual review',
            rating: 5,
            userId: 'user-A',
            productId: 'A',
        });
        expect(
            collections.products.get('A').activeIngestionRunId
        ).toBeUndefined();
        expect(
            await getIngestionRun('user-A', 'A', result.ingestionRunId, db)
        ).toMatchObject(result);
        expect(await getIngestionRuns('user-A', 'A', db)).toHaveLength(1);
    });
    it.each(['B', 'missing'])(
        'rejects foreign/missing product %s before any provider call or run write',
        async (productId) => {
            const { db, collections } = fakeDb();
            const fetchReviews = jest.fn();
            await expect(
                importReviews('user-A', productId, { db, fetchReviews })
            ).rejects.toMatchObject({ status: 404 });
            expect(fetchReviews).not.toHaveBeenCalled();
            expect(collections.ingestionRuns.size).toBe(0);
        }
    );
    it.each([undefined, '', ' '])(
        'rejects unusable uid (%s) without database initialization',
        async (uid) => {
            await expect(importReviews(uid, 'A')).rejects.toMatchObject({
                status: 401,
            });
            await expect(getIngestionRuns(uid, 'A')).rejects.toMatchObject({
                status: 401,
            });
        }
    );
    it.each(['', 'nested/id'])(
        'rejects invalid product identifier %s',
        async (id) => {
            await expect(importReviews('user-A', id)).rejects.toMatchObject({
                status: 400,
            });
        }
    );
    it('validates the stored source before starting a provider request', async () => {
        const { db, collections } = fakeDb();
        collections.products.set('A', {
            userId: 'user-A',
            amazonUrl: 'https://evil.example',
        });
        const fetchReviews = jest.fn();
        await expect(
            importReviews('user-A', 'A', { db, fetchReviews })
        ).rejects.toMatchObject({ status: 400 });
        expect(fetchReviews).not.toHaveBeenCalled();
        expect(collections.ingestionRuns.size).toBe(0);
    });
    it.each(
        [[], [null], [{ text: '', rating: 5 }]].map((records) => [records])
    )(
        'records empty/all-invalid result as failure, preserving existing reviews (%j)',
        async (records) => {
            const { db, collections } = fakeDb();
            collections.reviews.set('old', {
                userId: 'user-A',
                productId: 'A',
                text: 'Keep',
                rating: 4,
            });
            await expect(
                importReviews('user-A', 'A', {
                    db,
                    fetchReviews: async () => records,
                })
            ).rejects.toMatchObject({ code: 'NO_VALID_REVIEWS' });
            expect([...collections.ingestionRuns.values()][0]).toMatchObject({
                status: 'failed',
                savedCount: 0,
            });
            expect(collections.reviews.size).toBe(1);
        }
    );
    it('sanitizes provider failures, records failure and releases the lock', async () => {
        const { db, collections } = fakeDb();
        await expect(
            importReviews('user-A', 'A', {
                db,
                fetchReviews: async () => {
                    throw Object.assign(new Error('secret-cookie'), {
                        code: 'PROVIDER_TIMEOUT',
                    });
                },
            })
        ).rejects.toMatchObject({
            status: 502,
            code: 'UPSTREAM_PROVIDER_ERROR',
        });
        const run = [...collections.ingestionRuns.values()][0];
        expect(run.status).toBe('failed');
        expect(JSON.stringify(run)).not.toContain('secret-cookie');
        expect(JSON.stringify(log.mock.calls)).not.toContain('secret-cookie');
        expect(
            collections.products.get('A').activeIngestionRunId
        ).toBeUndefined();
    });
    it('rolls back review writes when the success transaction fails', async () => {
        const { db, collections, state } = fakeDb();
        state.failSuccess = true;
        await expect(
            importReviews('user-A', 'A', {
                db,
                fetchReviews: async () => [valid],
            })
        ).rejects.toMatchObject({ status: 500 });
        expect(collections.reviews.size).toBe(0);
        expect([...collections.ingestionRuns.values()][0]).toMatchObject({
            status: 'failed',
            savedCount: 0,
        });
    });
    it('recognizes a committed success after a lost acknowledgement', async () => {
        const { db, collections, state } = fakeDb();
        state.loseSuccessAck = true;
        const result = await importReviews('user-A', 'A', {
            db,
            fetchReviews: async () => [valid],
        });
        expect(result).toMatchObject({ status: 'succeeded', savedCount: 1 });
        expect(collections.reviews.size).toBe(1);
    });
    it('reports unconfirmed state when failure tracking is unavailable', async () => {
        const { db, collections, state } = fakeDb();
        state.failFailure = true;
        await expect(
            importReviews('user-A', 'A', {
                db,
                fetchReviews: async () => {
                    throw new Error('secret');
                },
            })
        ).rejects.toMatchObject({ code: 'INGESTION_STATE_UNAVAILABLE' });
        expect([...collections.ingestionRuns.values()][0].status).toBe(
            'processing'
        );
    });
    it('prevents overlapping requests from consuming another provider call', async () => {
        const { db } = fakeDb();
        let release;
        let started;
        const ready = new Promise((resolve) => {
            started = resolve;
        });
        const fetchReviews = jest.fn(async () => {
            started();
            return new Promise((resolve) => {
                release = resolve;
            });
        });
        const first = importReviews('user-A', 'A', { db, fetchReviews });
        await ready;
        await expect(
            importReviews('user-A', 'A', { db, fetchReviews })
        ).rejects.toMatchObject({ status: 409, code: 'INGESTION_IN_PROGRESS' });
        expect(fetchReviews).toHaveBeenCalledTimes(1);
        release([valid]);
        await first;
    });
    it('recovers an expired run on the next request', async () => {
        const { db, collections } = fakeDb();
        collections.products.set('A', {
            userId: 'user-A',
            amazonUrl: url,
            activeIngestionRunId: 'old',
            ingestionLockUntil: 1,
        });
        collections.ingestionRuns.set('old', {
            userId: 'user-A',
            productId: 'A',
            status: 'processing',
        });
        await importReviews('user-A', 'A', {
            db,
            fetchReviews: async () => [valid],
        });
        expect(collections.ingestionRuns.get('old')).toMatchObject({
            status: 'failed',
            error: { code: 'INGESTION_INTERRUPTED' },
        });
    });
    it('rechecks ownership after retrieval before persisting reviews', async () => {
        const { db, collections } = fakeDb();
        await expect(
            importReviews('user-A', 'A', {
                db,
                fetchReviews: async () => {
                    collections.products.set('A', {
                        userId: 'user-B',
                        amazonUrl: url,
                    });
                    return [valid];
                },
            })
        ).rejects.toMatchObject({ status: 404 });
        expect(collections.reviews.size).toBe(0);
    });
    it('rejects oversize normalized collections without partial persistence', async () => {
        const { db, collections } = fakeDb();
        await expect(
            importReviews('user-A', 'A', {
                db,
                fetchReviews: async () => Array(401).fill(valid),
            })
        ).rejects.toMatchObject({ status: 400 });
        expect(collections.reviews.size).toBe(0);
        expect([...collections.ingestionRuns.values()][0].status).toBe(
            'failed'
        );
    });
    it('does not expose runs through another owner or target', async () => {
        const { db, collections } = fakeDb();
        const result = await importReviews('user-A', 'A', {
            db,
            fetchReviews: async () => [valid],
        });
        await expect(
            getIngestionRun('user-B', 'A', result.ingestionRunId, db)
        ).rejects.toMatchObject({ status: 404 });
        await expect(
            getIngestionRun('user-A', 'A2', result.ingestionRunId, db)
        ).rejects.toMatchObject({ status: 404 });
        expect(await getIngestionRuns('user-A', 'A2', db)).toEqual([]);
        collections.ingestionRuns.set('foreign', {
            userId: 'user-B',
            productId: 'A',
            status: 'failed',
        });
        expect(await getIngestionRuns('user-A', 'A', db)).toHaveLength(1);
    });
});
