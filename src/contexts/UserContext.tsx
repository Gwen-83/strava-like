import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import type { SportType } from "../types/Activity";

type Period = "week" | "month" | "year";
type ObjectiveKind = "sessions" | "hours" | "distance" | "totalHours" | "elevation";

export type Objective = {
	id: string;
	kind: ObjectiveKind;
	value: number;
	period?: Period;
	unit?: string;
	note?: string;
	sport?: SportType; // optional sport associated with this objective
};

type UserState = {
	email: string;
	username: string;
	sport: string;
	objectives: Objective[];
	activities: any[];
	setEmail: (e: string) => void;
	setUsername: (u: string) => void;
	setSport: (s: string) => void;
	addObjective: (o: Omit<Objective, "id">) => void;
	updateObjective: (id: string, patch: Partial<Objective>) => void;
	removeObjective: (id: string) => void;
	clearActivities: () => void; // reverted to sync
	logout: () => void;
};

const STORAGE_KEY = "strava_like_user_v2";

// Create a nullable context so we can detect missing provider at runtime
const UserContext = createContext<UserState | null>(null);

export const UserProvider: React.FC<React.PropsWithChildren<{}>> = ({ children }) => {
	const [email, setEmailState] = useState<string>("");
	const [username, setUsernameState] = useState<string>("");
	const [sport, setSportState] = useState<string>("");
	const [objectives, setObjectives] = useState<Objective[]>([]);
	const [activities, setActivities] = useState<any[]>([]);

	// load from localStorage
	useEffect(() => {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (raw) {
				const parsed = JSON.parse(raw);
				if (parsed.email) setEmailState(parsed.email);
				if (parsed.username) setUsernameState(parsed.username);
				if (parsed.sport) setSportState(parsed.sport);
				if (Array.isArray(parsed.objectives)) setObjectives(parsed.objectives);
				if (Array.isArray(parsed.activities)) setActivities(parsed.activities);
			}
		} catch {}
	}, []);

	// persist on change
	useEffect(() => {
		const toSave = { email, username, sport, objectives, activities };
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
		} catch {}
	}, [email, username, sport, objectives, activities]);

	// Try to read Firebase auth/email and optionally Firestore user doc (dynamic import so it fails gracefully).
	// If a Firebase user is present we will load remote data (and later persist changes back).
	const firebaseCtx = useRef<any>(null);

	useEffect(() => {
		(async () => {
			// Helper to try modular API first (v9+)
			try {
				const authMod = await import("firebase/auth");
				const firestoreMod = await import("firebase/firestore");
				const { getAuth, onAuthStateChanged } = authMod as any;
				const { getFirestore, doc, getDoc, setDoc } = firestoreMod as any;

				if (typeof getAuth === "function") {
					const auth = getAuth();
					const dbGetter = getFirestore;
					firebaseCtx.current = { auth, dbGetter, doc, getDoc, setDoc };

					// load current user doc if available
					const maybeUser = (auth && auth.currentUser) || null;
					if (maybeUser) {
						const uid = maybeUser.uid || maybeUser.email || null;
						if (maybeUser.email) setEmailState(maybeUser.email);
						// attempt to load Firestore doc
						try {
							const db = dbGetter();
							const docRef = doc(db, "users", uid);
							const snap = await getDoc(docRef);
							if (snap && snap.exists && snap.exists()) {
								const data = snap.data() || {};
								if (data.email) setEmailState(data.email);
								if (data.username) setUsernameState(data.username);
								if (data.sport) setSportState(data.sport);
								if (Array.isArray(data.objectives)) setObjectives(data.objectives);
								if (Array.isArray(data.activities)) setActivities(data.activities);
							}
						} catch {
							// ignore firestore read error
						}
					}

					// subscribe to auth state changes to fetch remote profile when user signs in
					if (typeof onAuthStateChanged === "function") {
						onAuthStateChanged(auth, async (u: any) => {
							if (u) {
								if (u.email) setEmailState(u.email);
								const uid = u.uid || u.email || null;
								if (uid && firebaseCtx.current && firebaseCtx.current.dbGetter) {
									try {
										const db = firebaseCtx.current.dbGetter();
										const docRef = firebaseCtx.current.doc(db, "users", uid);
										const snap = await firebaseCtx.current.getDoc(docRef);
										if (snap && snap.exists && snap.exists()) {
											const data = snap.data() || {};
											if (data.email) setEmailState(data.email);
											if (data.username) setUsernameState(data.username);
											if (data.sport) setSportState(data.sport);
											if (Array.isArray(data.objectives)) setObjectives(data.objectives);
											if (Array.isArray(data.activities)) setActivities(data.activities);
										}
									} catch {
										// ignore
									}
								}
							}
						});
					}
					return;
				}
			} catch {
				// ignore modular import error and try namespaced below
			}

			// Fallback: check window.firebase (namespaced, v8)
			try {
				const fb = (window as any).firebase;
				if (fb && typeof fb.auth === "function" && typeof fb.firestore === "function") {
					const auth = fb.auth();
					const db = fb.firestore();
					firebaseCtx.current = { auth, db };

					const user = auth.currentUser || null;
					if (user && user.email) setEmailState(user.email);
					if (user) {
						// try to read user doc (/users/{uid_or_email}) if available
						try {
							const uid = user.uid || user.email;
							const docRef = db.collection("users").doc(uid);
							const snap = await docRef.get();
							if (snap && snap.exists) {
								const data = snap.data() || {};
								if (data.email) setEmailState(data.email);
								if (data.username) setUsernameState(data.username);
								if (data.sport) setSportState(data.sport);
								if (Array.isArray(data.objectives)) setObjectives(data.objectives);
								if (Array.isArray(data.activities)) setActivities(data.activities);
							}
						} catch {
							// ignore
						}
					}
					if (typeof auth.onAuthStateChanged === "function") {
						auth.onAuthStateChanged(async (u: any) => {
							if (u && u.email) setEmailState(u.email);
							if (u && firebaseCtx.current && firebaseCtx.current.db) {
								try {
									const uid = u.uid || u.email;
									const docRef = firebaseCtx.current.db.collection("users").doc(uid);
									const snap = await docRef.get();
									if (snap && snap.exists) {
										const data = snap.data() || {};
										if (data.email) setEmailState(data.email);
										if (data.username) setUsernameState(data.username);
										if (data.sport) setSportState(data.sport);
										if (Array.isArray(data.objectives)) setObjectives(data.objectives);
										if (Array.isArray(data.activities)) setActivities(data.activities);
									}
								} catch {}
							}
						});
					}
				}
			} catch {
				// firebase not available — do nothing
			}
		})();
	}, []);

	// persist on change (localStorage + optional firestore if user connected)
	useEffect(() => {
		const toSave = { email, username, sport, objectives, activities };
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
		} catch {}

		// try to save to Firestore if available and user is authenticated
		(async () => {
			try {
				if (firebaseCtx.current) {
					// modular API
					if (firebaseCtx.current.dbGetter) {
						const db = firebaseCtx.current.dbGetter();
						// try to get uid/email for doc id
						const auth = firebaseCtx.current.auth;
						const user = auth && auth.currentUser;
						const uid = (user && (user.uid || user.email)) || null;
						if (uid) {
							const docRef = firebaseCtx.current.doc(db, "users", uid);
							await firebaseCtx.current.setDoc(docRef, toSave, { merge: true });
						}
					} else if (firebaseCtx.current.db && firebaseCtx.current.auth) {
						// namespaced v8
						const db = firebaseCtx.current.db;
						const auth = firebaseCtx.current.auth;
						const user = auth.currentUser;
						const uid = (user && (user.uid || user.email)) || null;
						if (uid) {
							await db.collection("users").doc(uid).set(toSave, { merge: true });
						}
					}
				}
			} catch {
				// ignore firestore write error
			}
		})();
	}, [email, username, sport, objectives, activities]);

	const setEmail = (e: string) => setEmailState(e);
	const setUsername = (u: string) => setUsernameState(u);
	const setSport = (s: string) => setSportState(s);

	const addObjective = useCallback((o: Omit<Objective, "id">) => {
		const newObj: Objective = { ...o, id: uuidv4() };
		setObjectives((prev) => [...prev, newObj]);
	}, []);

	const updateObjective = useCallback((id: string, patch: Partial<Objective>) => {
		setObjectives((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
	}, []);

	const removeObjective = useCallback((id: string) => {
		setObjectives((prev) => {
			const next = prev.filter((o) => o.id !== id);

			// attempt immediate remote update (async, fire-and-forget)
			(async () => {
				try {
					if (firebaseCtx.current) {
						if (firebaseCtx.current.dbGetter) {
							const db = firebaseCtx.current.dbGetter();
							const auth = firebaseCtx.current.auth;
							const user = auth && auth.currentUser;
							const uid = (user && (user.uid || user.email)) || null;
							if (uid) {
								const docRef = firebaseCtx.current.doc(db, "users", uid);
								await firebaseCtx.current.setDoc(docRef, { objectives: next }, { merge: true });
							}
						} else if (firebaseCtx.current.db && firebaseCtx.current.auth) {
							const db = firebaseCtx.current.db;
							const auth = firebaseCtx.current.auth;
							const user = auth.currentUser;
							const uid = (user && (user.uid || user.email)) || null;
							if (uid) {
								await db.collection("users").doc(uid).set({ objectives: next }, { merge: true });
							}
						}
					}
				} catch {
					// ignore firestore write errors (existing behavior)
				}
			})();

			return next;
		});
	}, []);

	const clearActivities = () => {
		setActivities([]);
	};

	const logout = () => {
		setEmailState("");
		setUsernameState("");
		setSportState("");
		setObjectives([]);
		setActivities([]);
		try {
			localStorage.removeItem(STORAGE_KEY);
		} catch {}
	};

	return (
		<UserContext.Provider
			value={{
				email,
				username,
				sport,
				objectives,
				activities,
				setEmail,
				setUsername,
				setSport,
				addObjective,
				updateObjective,
				removeObjective,
				clearActivities,
				logout,
			}}
		>
			{children}
		</UserContext.Provider>
	);
};

export const useUser = (): UserState => {
	const ctx = useContext(UserContext);
	if (!ctx) {
		// Throw a clear error so the developer sees the cause instead of silent no-op behavior
		throw new Error(
			"useUser must be used within a UserProvider. Wrap your app root with <UserProvider> (e.g. in index.tsx)."
		);
	}
	return ctx;
};

export default UserContext;
