"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import styles from "./create-room.module.css";

export function CreateRoom() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [seatCount, setSeatCount] = useState<3 | 4>(4);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/rooms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, seatCount }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message ?? "Could not open the table");
      router.push(`/r/${result.slug}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open the table");
      setBusy(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={submit}>
      <label>
        <span>Your table name</span>
        <input required maxLength={24} value={name} onChange={(event) => setName(event.target.value)} placeholder="What should we call you?" autoComplete="nickname" />
      </label>
      <fieldset>
        <legend>Seats</legend>
        {[3, 4].map((count) => (
          <button className={seatCount === count ? styles.selected : ""} type="button" key={count} onClick={() => setSeatCount(count as 3 | 4)} aria-pressed={seatCount === count}>
            {count} players
          </button>
        ))}
      </fieldset>
      <button className={styles.submit} disabled={busy}>{busy ? "Laying the map…" : "Open a table"}<span aria-hidden="true">↗</span></button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  );
}
