import { useEffect, useMemo, useState } from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { auth } from '../lib/firebase.js';
import { AuthContext } from '../features/auth/authContext.js';

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: (email, password) => signInWithEmailAndPassword(auth, email, password),
      register: (email, password) => createUserWithEmailAndPassword(auth, email, password),
      loginWithGoogle: () => signInWithPopup(auth, new GoogleAuthProvider()),
      resetPassword: (email) => sendPasswordResetEmail(auth, email),
      logout: () => signOut(auth),
      getIdToken: () => (auth.currentUser ? auth.currentUser.getIdToken() : Promise.resolve(null)),
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
