"use client";

type MatchGuideModalProps = {
  open: boolean;
  onClose: () => void;
};

const GUIDE_STEPS = [
  {
    title: "Pick a match type",
    body: "Choose RAC Match for practice stakes or USDT Match for real-stake rooms.",
  },
  {
    title: "Select a stake room",
    body: "Open Select Room and join one of the five stake levels: 1, 2, 5, 10, or 20.",
  },
  {
    title: "Get paired instantly",
    body: "The arena matches you with another player in the same room and stake amount.",
  },
  {
    title: "Lock in your move",
    body: "Choose rock, paper, or scissors before the countdown ends. Moves stay hidden until both players choose.",
  },
  {
    title: "Win the match",
    body: "Win 2 rounds first to take the match. The winner receives the payout from the match pool.",
  },
];

const GUIDE_NOTES = [
  "RAC matches use your RAC balance for practice play.",
  "USDT matches use your USDT balance for competitive stakes.",
  "Live Matches below show active games happening right now.",
  "Log in to join a room and start playing.",
];

function MatchGuideIcon() {
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

export function MatchGuideButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="matchGuideBtn"
      onClick={onClick}
      aria-label="Open match guide"
    >
      <MatchGuideIcon />
    </button>
  );
}

export function MatchGuideModal({ open, onClose }: MatchGuideModalProps) {
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
        className="modal guideVideoModal matchGuideModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-guide-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="guideVideoModalTop">
          <div>
            <div className="guideVideoModalTitle" id="match-guide-title">
              Match Guide
            </div>
            <div className="guideVideoModalSubtitle">
              Learn how to join a room, play rounds, and win your match.
            </div>
          </div>
          <button
            className="guideVideoCloseBtn"
            type="button"
            onClick={onClose}
            aria-label="Close match guide"
          >
            ✕
          </button>
        </div>

        <div className="matchGuideBody">
          <section className="matchGuideHero">
            <span className="matchGuideHeroIcon" aria-hidden="true">
              <span className="matchGuideHeroEmoji">✊</span>
              <span className="matchGuideHeroVs">VS</span>
              <span className="matchGuideHeroEmoji">✌️</span>
            </span>
            <div>
              <h3>How matches work</h3>
              <p>
                Roshambo matches are fast head-to-head battles. Pick your match
                type, join a stake room, and outplay your opponent in rock-paper-scissors.
              </p>
            </div>
          </section>

          <ol className="matchGuideSteps">
            {GUIDE_STEPS.map((step, index) => (
              <li key={step.title} className="matchGuideStep">
                <span className="matchGuideStepNum">{index + 1}</span>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <section className="matchGuideNotes">
            <h3>Good to know</h3>
            <ul>
              {GUIDE_NOTES.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
