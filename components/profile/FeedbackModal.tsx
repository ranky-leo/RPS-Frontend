"use client";

import { FEEDBACK_REWARD_RAC } from "../../lib/feedback";
import { ProfileFeedbackPanel } from "./ProfileFeedbackPanel";

type FeedbackModalProps = {
  open: boolean;
  onClose: () => void;
};

export function FeedbackTopbarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-4 4V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
      />
      <path
        d="M8 10h8"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
      <path
        d="M8 13.5h5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

function FeedbackRewardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 14.2 8.6 20 9.3l-4.5 3.7 1.4 5.5L12 16.2 7.1 18.5l1.4-5.5L4 9.3l5.8-.7L12 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FeedbackModal({ open, onClose }: FeedbackModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className="backdrop feedbackBackdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className="modal feedbackModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feedback-modal-title"
        aria-describedby="feedback-modal-description"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="feedbackModalGlow" aria-hidden="true" />

        <div className="feedbackModalHeader">
          <div className="feedbackModalHeaderMain">
            <div className="feedbackModalHeaderIcon" aria-hidden="true">
              <FeedbackTopbarIcon />
            </div>
            <div>
              <h2 id="feedback-modal-title" className="feedbackModalTitle">
                Share your feedback
              </h2>
              <p className="feedbackModalSubtitle">
                Help us improve RPS Arena and earn rewards.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="feedbackModalClose"
            aria-label="Close feedback"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="feedbackModalBody">
          <section className="feedbackModalIntro">
            <div className="feedbackModalRewardCard">
              <div className="feedbackModalRewardBadge">
                <FeedbackRewardIcon />
                <span>Compensation</span>
              </div>
              <div className="feedbackModalRewardAmount">
                <span className="feedbackModalRewardValue">{FEEDBACK_REWARD_RAC}</span>
                <span className="feedbackModalRewardLabel">RAC</span>
              </div>
              <p id="feedback-modal-description" className="feedbackModalRewardCopy">
                If your submitted feedback passes the admin&apos;s review, you will
                receive compensation credited to your account.
              </p>
            </div>

            <ol className="feedbackModalSteps">
              <li className="feedbackModalStep">
                <span className="feedbackModalStepNumber">1</span>
                <span className="feedbackModalStepText">
                  Submit your ideas, bugs, or suggestions below.
                </span>
              </li>
              <li className="feedbackModalStep">
                <span className="feedbackModalStepNumber">2</span>
                <span className="feedbackModalStepText">
                  An admin reviews your submission.
                </span>
              </li>
              <li className="feedbackModalStep">
                <span className="feedbackModalStepNumber">3</span>
                <span className="feedbackModalStepText">
                  Approved feedback earns {FEEDBACK_REWARD_RAC} RAC automatically.
                </span>
              </li>
            </ol>
          </section>

          <ProfileFeedbackPanel variant="modal" />
        </div>
      </div>
    </div>
  );
}
