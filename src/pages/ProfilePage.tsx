import { useEffect, useState } from "react"
import { useUser } from "../contexts/UserContext"
import type { Objective } from "../contexts/UserContext"
import type { SportType } from "../types/Activity"
import "../styles/ProfilePage.css"

const AVAILABLE_SPORTS = [
	"Course à pied",
	"Vélo",
	"Natation",
	"Randonnée",
	"Fitness",
	"Autre",
]

const OBJECTIVE_KINDS = [
	{ value: "sessions", label: "Nombre d'entraînements" },
	{ value: "hours", label: "Nombre d'heures" },
	{ value: "distance", label: "Distance" },
	{ value: "totalHours", label: "Total d'heures (global)" },
	{ value: "elevation", label: "Dénivelé positif" }, // new
]

const PERIODS = [
	{ value: "week", label: "par semaine" },
	{ value: "month", label: "par mois" },
	{ value: "year", label: "par an" },
]

const SPORT_OPTIONS: SportType[] = ["Cyclisme", "Course", "Marche", "Randonnée", "Autre"]

export default function ProfilePage() {
	const {
		email,
		username,
		sport,
		objectives,
		setEmail,
		setUsername,
		setSport,
		addObjective,
		updateObjective,
		removeObjective,
		logout,
	} = useUser()

	const [localEmail, setLocalEmail] = useState(email)
	const [localUsername, setLocalUsername] = useState(username)
	const [localSport, setLocalSport] = useState(sport || AVAILABLE_SPORTS[0])

	useEffect(() => {
		setLocalEmail(email)
		setLocalUsername(username)
		setLocalSport(sport || AVAILABLE_SPORTS[0])
	}, [email, username, sport])

	const handleSave = () => {
		if (localEmail) setEmail(localEmail)
		setUsername(localUsername)
		setSport(localSport)
	}

	// local state for creating a new objective
	const [newKind, setNewKind] = useState<Objective["kind"]>("sessions")
	const [newValue, setNewValue] = useState<number>(1)
	const [newPeriod, setNewPeriod] = useState<"week" | "month" | "year">("week")
	const [newUnit, setNewUnit] = useState<string>("km")
	const [newSport, setNewSport] = useState<SportType>(SPORT_OPTIONS[0])

	// ensure unit defaults follow selected kind
	useEffect(() => {
		if (newKind === "elevation") setNewUnit("m")
		else if (newKind === "distance") setNewUnit("km")
	}, [newKind])

	const handleAddObjective = () => {
		const base: Omit<Objective, "id"> = {
			kind: newKind,
			value: Number(newValue) || 0,
			unit: newUnit,
			period: newKind === "totalHours" ? undefined : newPeriod,
			sport: newKind === "totalHours" ? undefined : newSport,
		}
		addObjective(base)
		// reset
		setNewValue(1)
	}

	return (
		<section className="section-profile">
			<h3>Mon profil</h3>

			<div className="field">
				<label>Email utilisé pour le login</label>
				{email ? (
					<>
						<div className="small-muted">{email}</div>
					</>
				) : null}
			</div>

			<div className="field">
				<label>Nom d'utilisateur</label>
				<input
					className="input"
					placeholder="Pseudo public"
					value={localUsername || ""}
					onChange={(e) => setLocalUsername(e.target.value)}
				/>
			</div>

			<div className="field">
				<label>Sport principal</label>
				<select
					className="select"
					value={localSport}
					onChange={(e) => setLocalSport(e.target.value)}
				>
					{AVAILABLE_SPORTS.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
			</div>

			<div className="field">
				<label>Objectifs</label>

				{/* existing objectives list */}
				{objectives && objectives.length > 0 ? (
					<div style={{ marginBottom: 8 }}>
						{objectives.map((o) => (
							<div key={o.id} style={{ border: "1px solid #eee", padding: 8, marginBottom: 6, borderRadius: 6 }}>
								<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
									<div>
										<strong>
											{o.kind === "sessions" && `${o.value} séance(s) ${o.period ? ` ${o.period}` : ""}`}
											{o.kind === "hours" && `${o.value} h ${o.period ? ` ${o.period}` : ""}`}
											{o.kind === "distance" && `${o.value} ${o.unit || "km"} ${o.period ? ` ${o.period}` : ""}`}
											{o.kind === "elevation" && `${o.value} ${o.unit || "m"} ${o.period ? ` ${o.period}` : ""}`}										
											{o.kind === "totalHours" && `${o.value} h (total)`} 
										</strong>
										{ o.sport ? <div className="small-muted">Sport : {o.sport}</div> : null }
										{ o.note ? <div className="small-muted">{o.note}</div> : null }
									</div>
									<div style={{ display: "flex", gap: 8 }}>
										<button className="btn btn-ghost" onClick={() => {
											const updatedNote = prompt("Note (facultative)", o.note || "") || o.note
											updateObjective(o.id, { note: updatedNote })
										}}>Modifier</button>
										<button className="btn btn-danger" onClick={() => removeObjective(o.id)}>Supprimer</button>
									</div>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="small-muted">Aucun objectif défini.</div>
				)}

				{/* add new objective */}
				<div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center", flexWrap: "wrap" }}>
					<select value={newKind} onChange={(e) => setNewKind(e.target.value as Objective["kind"])} className="select">
						{OBJECTIVE_KINDS.map((k) => (
							<option key={k.value} value={k.value}>
								{k.label}
							</option>
						))}
					</select>

					<input className="input" type="number" min={0} value={String(newValue)} onChange={(e) => setNewValue(Number(e.target.value))} style={{ width: 100 }} />

					{newKind !== "totalHours" ? (
						<select value={newPeriod} onChange={(e) => setNewPeriod(e.target.value as any)} className="select">
							{PERIODS.map((p) => (
								<option key={p.value} value={p.value}>
									{p.label}
								</option>
							))}
						</select>
					) : null}

					{newKind === "distance" ? (
						<select value={newUnit} onChange={(e) => setNewUnit(e.target.value)} className="select" style={{ width: 100 }}>
							<option value="km">km</option>
							<option value="mi">mi</option>
						</select>
					) : newKind === "elevation" ? (
						<select value={newUnit} onChange={(e) => setNewUnit(e.target.value)} className="select" style={{ width: 100 }}>
							<option value="m">m</option>
							<option value="ft">ft</option>
						</select>
					) : newKind === "hours" || newKind === "totalHours" ? (
						<span className="small-muted">h</span>
					) : null}

					{/* sport selector for the objective */}
					<select className="select" value={newSport} onChange={(e) => setNewSport(e.target.value as SportType)} style={{ width: 140 }}>
						{SPORT_OPTIONS.map((s) => (
							<option key={s} value={s}>{s}</option>
						))}
					</select>

					<button className="btn btn-primary" onClick={handleAddObjective}>
						Ajouter
					</button>
				</div>
			</div>

			<div className="actions">
				<button className="btn btn-primary" onClick={handleSave}>
					Enregistrer
				</button>
				<button
					className="btn btn-danger"
					onClick={() => {
						logout()
						alert("Déconnecté.")
					}}
				>
					Se déconnecter
				</button>
			</div>

			<p style={{ marginTop: 12 }} className="small-muted">
				Les objectifs sont structurés et persistés via le contexte utilisateur (accessible depuis d'autres pages).
			</p>
		</section>
	)
}
