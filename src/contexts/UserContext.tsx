import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
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

	// Try to read Firebase auth email if firebase is present (dynamic import so it fails gracefully)
	useEffect(() => {
		(async () => {
			// Try modular API (firebase v9+)
			try {
				const mod = await import("firebase/auth");
				const { getAuth, onAuthStateChanged } = mod as any;
				if (typeof getAuth === "function") {
					const auth = getAuth();
					// current user if available
					const user = (auth && auth.currentUser) || null;
					if (user && user.email) setEmailState(user.email);
					if (typeof onAuthStateChanged === "function") {
						onAuthStateChanged(auth, (u: any) => {
							if (u && u.email) setEmailState(u.email);
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
				if (fb && typeof fb.auth === "function") {
					const auth = fb.auth();
					const user = auth.currentUser || null;
					if (user && user.email) setEmailState(user.email);
					if (typeof auth.onAuthStateChanged === "function") {
						auth.onAuthStateChanged((u: any) => {
							if (u && u.email) setEmailState(u.email);
						});
					}
				}
			} catch {
				// firebase not available — do nothing
			}
		})();
	}, []);

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
		setObjectives((prev) => prev.filter((o) => o.id !== id));
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
