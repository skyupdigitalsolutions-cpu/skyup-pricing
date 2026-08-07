import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Star, Quote, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import "./Testimonials.css";

const TESTIMONIALS = [
  { name: "Syeed", company: "", review: "We were struggling to keep track of leads and follow-ups before using the CRM. Now everything is organized in one place, and our team never misses an inquiry. It has saved us a lot of time and improved our customer response significantly." },
  { name: "Suhas", company: "Sarthi", review: "We needed a CRM that was simple yet powerful, and this was exactly what we were looking for. The WhatsApp integration and automated follow-ups have made our sales process much smoother. Highly recommended for growing businesses." },
  { name: "Raymond", company: "", review: "The CRM has completely changed how we manage our customers. From lead tracking to sales updates, everything is available in real time. It's easy to use, and our productivity has improved a lot." },
  { name: "Amith Kumar", company: "", review: "Before implementing this CRM, we were managing everything manually. Now our team has complete visibility of every lead and customer interaction. It has definitely helped us close more business with less effort." },
  { name: "Moqsood", company: "Launcher Desk", review: "One feature I really appreciate is the automation. It reduces repetitive work and ensures every lead gets followed up on time. The dashboard is clean, fast, and makes daily operations much easier." },
  { name: "Pooja", company: "Rathana Bhoomi", review: "Managing property inquiries used to be difficult with multiple channels. This CRM brought everything together in one place, making lead management effortless. Our response time has improved, and clients appreciate the quick communication." },
  { name: "Umesha", company: "Gruhakalpa", review: "This CRM has helped us organize our sales process from start to finish. Every inquiry is properly tracked, and follow-ups happen without depending on manual reminders. It has become an important part of our daily workflow." },
  { name: "Isiri", company: "", review: "I was looking for a solution that my entire team could use without much training. The interface is simple, and everyone adapted quickly. It has made customer management much more efficient." },
  { name: "Kuthadra", company: "", review: "What impressed me the most was how customizable the CRM is. We could adapt it to our business process without any hassle. The support team was also very responsive whenever we needed assistance." },
];

const TRUST_BADGES = [
  "Better Lead Management",
  "Faster Follow-ups",
  "WhatsApp Automation",
  "Sales Pipeline Tracking",
  "AI Powered CRM",
];

function getInitials(name) {
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// shortest signed distance from `active` to `i` around a circular list of
// length n — this is what lets the two neighbours peek on either side of
// the centered card instead of only ever sliding one direction
function relativeOffset(i, active, n) {
  let diff = i - active;
  if (diff > n / 2) diff -= n;
  if (diff < -n / 2) diff += n;
  return diff;
}

function CardContent({ t }) {
  return (
    <>
      <span className="tst-quote-icon" aria-hidden="true"><Quote /></span>
      <div className="tst-card-top">
        <span className="tst-avatar" aria-hidden="true">{getInitials(t.name)}</span>
        <div className="tst-name-block">
          <div className="tst-name">{t.name}</div>
          {t.company && <div className="tst-company">{t.company}</div>}
        </div>
      </div>
      <div className="tst-stars" aria-label="5 out of 5 stars">
        {Array.from({ length: 5 }).map((_, i) => <Star key={i} fill="#fbbf24" color="#fbbf24" strokeWidth={0} />)}
      </div>
      <p className="tst-review">{t.review}</p>
    </>
  );
}

const AUTOPLAY_MS = 4000;
const RESUME_DELAY_MS = 6000;

function Coverflow({ items, reduceMotion }) {
  const [active, setActive] = useState(0);
  const pausedRef = useRef(false);
  const resumeTimerRef = useRef(null);
  const n = items.length;

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => {
      if (!pausedRef.current) setActive((i) => (i + 1) % n);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [n, reduceMotion]);

  const pauseThenResume = () => {
    pausedRef.current = true;
    clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => { pausedRef.current = false; }, RESUME_DELAY_MS);
  };
  const goTo = (i) => { setActive(((i % n) + n) % n); pauseThenResume(); };
  const prev = () => goTo(active - 1);
  const next = () => goTo(active + 1);

  return (
    <div
      className="tst-coverflow"
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
      onTouchStart={() => { pausedRef.current = true; }}
    >
      <button type="button" className="tst-cf-arrow tst-cf-arrow-prev" onClick={prev} aria-label="Previous testimonial">
        <ChevronLeft size={18} />
      </button>

      <div className="tst-cf-viewport">
        {items.map((t, i) => {
          const offset = relativeOffset(i, active, n);
          const abs = Math.abs(offset);
          const isCenter = offset === 0;
          const visible = abs <= 1;
          const target = reduceMotion
            ? { x: 0, scale: 1, opacity: isCenter ? 1 : 0, rotateY: 0, rotateZ: 0 }
            : {
                x: `${offset * 78}%`,
                scale: isCenter ? 1 : abs === 1 ? 0.82 : 0.7,
                opacity: isCenter ? 1 : abs === 1 ? 0.45 : 0,
                rotateY: isCenter ? 0 : offset > 0 ? -22 : 22,
                rotateZ: isCenter ? 0 : offset > 0 ? 3 : -3,
              };
          return (
            <div className="tst-cf-slot" key={t.name + i} style={{ zIndex: 10 - abs }}>
              <motion.div
                className="tst-card tst-cf-card"
                animate={target}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  transformPerspective: 1000,
                  pointerEvents: visible ? "auto" : "none",
                  cursor: isCenter ? "default" : "pointer",
                }}
                onClick={() => !isCenter && goTo(i)}
                aria-hidden={!visible}
              >
                <CardContent t={t} />
              </motion.div>
            </div>
          );
        })}
      </div>

      <button type="button" className="tst-cf-arrow tst-cf-arrow-next" onClick={next} aria-label="Next testimonial">
        <ChevronRight size={18} />
      </button>

      <div className="tst-dots">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            className={"tst-dot" + (i === active ? " active" : "")}
            onClick={() => goTo(i)}
            aria-label={`Go to testimonial ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

const trustContainerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};
const trustBadgeVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.9 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
};

export default function Testimonials() {
  const prefersReducedMotion = useReducedMotion();
  const reduceMotion = !!prefersReducedMotion;

  return (
    <section className="tst-section">
      <span className="tst-blob tst-blob-1" aria-hidden="true" />
      <span className="tst-blob tst-blob-2" aria-hidden="true" />

      <div className="wrap tst-wrap">
        <motion.div
          className="tst-head"
          initial={reduceMotion ? undefined : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="tst-badge"><Star size={12} fill="#fbbf24" color="#fbbf24" strokeWidth={0} /> Trusted by Businesses Across Industries</span>
          <h2 className="tst-heading">Loved by Businesses That Use Our CRM Every Day</h2>
          <p className="tst-sub">See how companies are improving lead management, follow-ups, and sales productivity with our Smart CRM.</p>
        </motion.div>

        <Coverflow items={TESTIMONIALS} reduceMotion={reduceMotion} />

        <div className="tst-trust">
          <h3 className="tst-trust-title">Trusted by Growing Businesses</h3>
          <motion.div
            className="tst-trust-badges"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.4 }}
            variants={trustContainerVariants}
          >
            {TRUST_BADGES.map((b) => (
              <motion.span key={b} className="tst-trust-badge" variants={trustBadgeVariants}>
                <CheckCircle2 size={15} /> {b}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
