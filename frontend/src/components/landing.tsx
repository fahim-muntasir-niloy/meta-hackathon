/* eslint-disable @next/next/no-img-element -- photos from Wikimedia Commons, credited below */
import { ArrowDown, ArrowUpRight, CalendarCheck, ClipboardList, FlaskConical, Mic, Plus, ScanSearch, Sprout } from "lucide-react";
import Link from "next/link";
import styles from "./landing.module.css";

// Openly licensed photos from Wikimedia Commons (credited in the footer).
const HERO = {
  src: "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d5/A_paddy_field_%28rice_field%29_in_bangladesh.jpg/1920px-A_paddy_field_%28rice_field%29_in_bangladesh.jpg",
  credit: "Shahidul Hasan Roman, CC BY-SA 4.0",
  page: "https://commons.wikimedia.org/wiki/File:A_paddy_field_(rice_field)_in_bangladesh.jpg",
};
const HARVEST = {
  src: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Rice_harvesting_by_farmers_in_a_wetland_field%2C_Bangladesh_2026_01.jpg/1280px-Rice_harvesting_by_farmers_in_a_wetland_field%2C_Bangladesh_2026_01.jpg",
  credit: "A S M Jobaer, CC BY-SA 4.0",
  page: "https://commons.wikimedia.org/wiki/File:Rice_harvesting_by_farmers_in_a_wetland_field,_Bangladesh_2026_01.jpg",
};

const SOURCES = ["কৃষকের জানালা", "DAE কীটনাশক নিবন্ধন", "WHO বিপদ শ্রেণি", "Open-Meteo", "Meta Muse · SAM 3.1"];

const FEATURES = [
  {
    icon: ScanSearch,
    title: "ছবি দেখে রোগ-পোকা চেনা",
    text: "পাতা বা গাছের ছবি পাঠালেই কৃষিবন্ধু দাগ, পোকা বা পচন চিহ্নিত করে দেখায়, ঠিক কোন জায়গা দেখে সে বলছে। নিশ্চিত না হলে তা-ই বলে, আর পরিষ্কার ছবি চায়।",
  },
  {
    icon: FlaskConical,
    title: "সরকারি পরামর্শ, নিবন্ধিত ওষুধ",
    text: "কৃষকের জানালার ৯৯৮টি সমস্যার পরামর্শ থেকে উত্তর দেয়। যে ওষুধ ওই ফসলের জন্য DAE-তে নিবন্ধিত নয়, তা কখনো বলে না। মাত্রা বিঘার হিসাবে, সাথে মানুষের জন্য বিপদের মাত্রা।",
  },
  {
    icon: ClipboardList,
    title: "দিনে দিনে চিকিৎসার পরিকল্পনা",
    text: "আজ কী করবেন, কবে স্প্রে, কবে আবার দেখবেন, সব তারিখ ধরে সাজানো থাকে। আবহাওয়া দেখে বৃষ্টির দিন এড়িয়ে স্প্রের দিন ঠিক করে।",
  },
  {
    icon: CalendarCheck,
    title: "কৃষি অফিসারের সাথে সাক্ষাৎ",
    text: "অবস্থা খারাপ হলে নিজের জেলার উপ-সহকারী কৃষি কর্মকর্তার সাথে ফোনে কথা, মাঠ পরিদর্শন বা অফিসে সাক্ষাতের সময় ঠিক করে দেয়, সমস্যার সারাংশসহ।",
  },
  {
    icon: Mic,
    title: "মুখে বললেই হয়",
    text: "লিখতে না চাইলে বোতাম চেপে বাংলায় বলুন। আগের কথা মনে রাখে, তাই জমি বা ফসলের কথা বারবার বলতে হয় না।",
  },
];

export function Landing() {
  return (
    <div className={styles.page}>
      <header className={styles.hero}>
        <img className={styles.heroImg} src={HERO.src} alt="বাংলাদেশের সবুজ ধানক্ষেত" fetchPriority="high" />
        <div className={styles.heroShade} aria-hidden />

        <nav className={styles.nav}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoMark}>
              <Sprout size={16} />
            </span>
            KrishiBondhu.AI
          </Link>
          <div className={styles.navLinks}>
            <a href="#about" className={styles.navActive}>
              পরিচিতি
            </a>
            <a href="#features">যা করে</a>
            <a href="#sources">তথ্যের উৎস</a>
          </div>
          <Link href="/chat" className={styles.navCta}>
            শুরু করুন
          </Link>
        </nav>

        <div className={styles.heroBody}>
          <h1>
            ফসলের সমস্যা চিনুন,
            <br />
            <em>এক ছবিতেই</em>
          </h1>
          <p>
            ছবি পাঠান বা মুখে বলুন। কৃষিবন্ধু সরকারি পরামর্শ মিলিয়ে বাংলায় চিকিৎসা সাজায়, দিনে দিনে খোঁজ রাখে, আর দরকারে কৃষি অফিসার
            ডেকে দেয়।
          </p>
          <div className={styles.heroActions}>
            <Link href="/chat" className={styles.primary}>
              পরামর্শ নিন <ArrowUpRight size={16} />
            </Link>
            <a href="#features" className={styles.ghost}>
              কীভাবে কাজ করে
            </a>
          </div>
        </div>

        <div className={styles.heroBar}>
          <a href="#about" className={styles.scroll}>
            নিচে দেখুন <ArrowDown size={14} />
          </a>
          <div className={styles.stats}>
            <span>
              <strong>৯৯৮</strong> ফসলের সমস্যা
            </span>
            <span>
              <strong>১২২</strong> ফসল
            </span>
            <span>
              <strong>৬৪</strong> জেলা
            </span>
          </div>
        </div>
      </header>

      <section id="sources" className={styles.sources}>
        <p>
          যে তথ্য আর প্রযুক্তির
          <br />
          <strong>ওপর ভর করে</strong>
        </p>
        <ul>
          {SOURCES.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </section>

      <section id="about" className={styles.statement}>
        <span className={styles.chip}>কৃষিবন্ধু</span>
        <p>
          বাংলাদেশের কৃষকের জন্য বাংলায় কথা বলা এক কৃষি সহকারী,{" "}
          <span>যে আন্দাজে নয়, সরকারি পরামর্শ আর নিবন্ধিত ওষুধের তালিকা মিলিয়ে উত্তর দেয়, আর না জানলে সোজা বলে দেয়।</span>
        </p>
      </section>

      <section id="features" className={styles.features}>
        <div className={styles.featuresHead}>
          <div>
            <span className={styles.chip}>যা করে</span>
            <h2>
              মাঠের সমস্যা থেকে
              <br />
              <em>সমাধান পর্যন্ত</em>
            </h2>
          </div>
          <p>
            একটা চ্যাটেই রোগ চেনা, চিকিৎসা, ফলো-আপ আর অফিসারের সাক্ষাৎ। কোনো অ্যাপ নামাতে হয় না, শুধু মোবাইল নম্বর দিয়ে শুরু।
          </p>
        </div>

        <div className={styles.featuresBody}>
          <div className={styles.accordion}>
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <details key={title} name="feature" open={i === 0}>
                <summary>
                  <span className={styles.featureIcon}>
                    <Icon size={16} />
                  </span>
                  {title}
                  <Plus size={16} className={styles.toggle} />
                </summary>
                <p>{text}</p>
              </details>
            ))}
          </div>
          <figure className={styles.photo}>
            <img src={HARVEST.src} alt="ধানক্ষেতে ধান কাটছেন কৃষকেরা" loading="lazy" />
          </figure>
        </div>
      </section>

      <section className={styles.cta}>
        <h2>
          আজই জানান, <em>ফসলের কী হয়েছে</em>
        </h2>
        <Link href="/chat" className={styles.primary}>
          চ্যাট শুরু করুন <ArrowUpRight size={16} />
        </Link>
      </section>

      <footer className={styles.footer}>
        <span>
          পরামর্শ AI দিয়ে তৈরি। রাসায়নিক ব্যবহারের আগে স্থানীয় কৃষি অফিসারের সাথে কথা বলুন।
        </span>
        <span>
          ছবি:{" "}
          <a href={HERO.page} target="_blank" rel="noopener noreferrer">
            {HERO.credit}
          </a>{" "}
          ·{" "}
          <a href={HARVEST.page} target="_blank" rel="noopener noreferrer">
            {HARVEST.credit}
          </a>
          , Wikimedia Commons
        </span>
      </footer>
    </div>
  );
}
