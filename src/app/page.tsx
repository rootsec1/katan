import { CreateRoom } from "@/components/create-room";
import Link from "next/link";
import styles from "./page.module.css";

const FEATURES = [
  ["A living chart", "Every coast, meadow, ridge, and harbor is drawn fresh for the table."],
  ["Friends or wayfinders", "Invite up to four people, or fill empty chairs with three levels of bots."],
  ["Nothing up our sleeve", "Private hands stay server-side. Every move is checked by one deterministic rules engine."],
];

export default function Home() {
  return (
    <main className={styles.page}>
      <nav className={styles.nav} aria-label="Primary navigation">
        <Link className={styles.brand} href="/" aria-label="Rill home"><i aria-hidden="true" />Rill</Link>
        <a className={styles.rulesLink} href="#how">How it flows</a>
      </nav>

      <section className={styles.hero}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>A shared table, wherever you are</p>
          <h1>Follow the river.<br /><em>Shape the land.</em></h1>
          <p className={styles.lede}>A richly illustrated strategy night for three or four friends. Gather resources, trace routes, found hamlets, and race to ten renown.</p>
          <CreateRoom />
          <p className={styles.note}>No account. One private invite. About 60–90 minutes.</p>
        </div>
        <div className={styles.tableau} aria-hidden="true">
          <div className={styles.sun} />
          <div className={styles.map}>
            {Array.from({ length: 19 }, (_, index) => <span key={index} style={{ "--i": index } as React.CSSProperties} />)}
            <b className={styles.routeOne} />
            <b className={styles.routeTwo} />
            <i className={styles.pawn} />
          </div>
          <div className={styles.rippleOne} />
          <div className={styles.rippleTwo} />
        </div>
      </section>

      <section className={styles.features} id="how" aria-label="What makes Rill special">
        {FEATURES.map(([title, description], index) => (
          <article key={title}>
            <span>0{index + 1}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </section>

      <footer className={styles.footer}>An independent, original game project · Designed for desktop play</footer>
    </main>
  );
}
