"use client";

type DailyMissionsGuideModalProps = {
  open: boolean;
  onClose: () => void;
};

const GUIDE_STEPS = [
  {
    title: "Check your missions",
    body: "Open the Daily Missions panel to see today's tasks, progress bars, and RAC rewards.",
  },
  {
    title: "Play and participate",
    body: "Progress updates automatically when you play matches, chat, watch live video, and stay online.",
  },
  {
    title: "Earn RAC instantly",
    body: "When a mission is completed, the RAC reward is credited to your account right away.",
  },
  {
    title: "Finish the bonus mission",
    body: "Complete every regular mission to unlock the Finish all missions today bonus reward.",
  },
];

const GUIDE_MISSION_TYPES = [
  "Play matches and rounds",
  "Win matches and perfect 2-0 wins",
  "Watch the live video",
  "Send chat messages",
  "Stay online and log in daily",
];

function DailyMissionsGuideIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 17.2v.01"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M12 14v-2.4c0-1.45 2.2-1.55 2.2-3.1a2.2 2.2 0 1 0-4.4 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function DailyMissionsGuideButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="dailyMissionsGuideBtn"
      onClick={onClick}
      aria-label="Open daily missions guide"
    >
      <DailyMissionsGuideIcon />
    </button>
  );
}

export function DailyMissionsGuideModal({
  open,
  onClose,
}: DailyMissionsGuideModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="backdrop guideVideoBackdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal guideVideoModal dailyMissionsGuideModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="daily-missions-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="guideVideoModalTop">
          <div>
            <div className="guideVideoModalTitle" id="daily-missions-guide-title">
              Daily Missions Guide
            </div>
            <div className="guideVideoModalSubtitle">
              Earn RAC every day by completing simple arena tasks.
            </div>
          </div>
          <button
            className="guideVideoCloseBtn"
            type="button"
            onClick={onClose}
            aria-label="Close daily missions guide"
          >
            ✕
          </button>
        </div>

        <div className="dailyMissionsGuideBody">
          <section className="dailyMissionsGuideHero">
            <span className="dailyMissionsGuideHeroIcon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="8"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <circle cx="12" cy="12" r="3.5" fill="currentColor" />
              </svg>
            </span>
            <div>
              <h3>How it works</h3>
              <p>
                Missions reset every day at midnight Asia/Shanghai time. The
                countdown in the panel shows how long is left in the current
                cycle.
              </p>
            </div>
          </section>

          <ol className="dailyMissionsGuideSteps">
            {GUIDE_STEPS.map((step, index) => (
              <li key={step.title} className="dailyMissionsGuideStep">
                <span className="dailyMissionsGuideStepNum">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <section className="dailyMissionsGuideTypes">
            <h3>Mission types you may see</h3>
            <ul>
              {GUIDE_MISSION_TYPES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
