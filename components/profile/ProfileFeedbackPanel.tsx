"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import { FEEDBACK_REWARD_RAC } from "../../lib/feedback";
import type { UserFeedbackItem } from "../../lib/types";

const STATUS_LABELS: Record<UserFeedbackItem["status"], string> = {
  pending: "Awaiting review",
  approved: "Approved",
  rejected: "Rejected",
};

type ProfileFeedbackPanelProps = {
  variant?: "default" | "modal";
};

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

export function ProfileFeedbackPanel({
  variant = "default",
}: ProfileFeedbackPanelProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [items, setItems] = useState<UserFeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isModal = variant === "modal";

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.myFeedback();
      setItems(response.feedback);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load your feedback",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  const hasPending = items.some((item) => item.status === "pending");

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      await api.submitFeedback({
        subject: subject.trim(),
        message: message.trim(),
      });
      setSubject("");
      setMessage("");
      setSuccess(
        `Thanks for your feedback. An admin will review it soon. If it passes review, you will receive ${FEEDBACK_REWARD_RAC} RAC as compensation.`,
      );
      await loadFeedback();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not submit feedback",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={`profileFeedbackPanel${isModal ? " profileFeedbackPanelModal" : ""}`}
    >
      <form className="profileFormCard" onSubmit={handleSubmit}>
        <div className="profileFormPanel">
          <div className="profileFieldGroup">
            <label className="profileFieldLabel" htmlFor="feedback-subject">
              Subject (optional)
            </label>
            <div className="profileInputWrap">
              <input
                id="feedback-subject"
                className="input profileInput"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="What is your feedback about?"
                maxLength={120}
                disabled={submitting || hasPending}
              />
            </div>
          </div>

          <div className="profileFieldGroup">
            <label className="profileFieldLabel" htmlFor="feedback-message">
              Message
            </label>
            <div className="profileInputWrap">
              <textarea
                id="feedback-message"
                className="input profileInput profileFeedbackTextarea"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Tell us how we can improve the site..."
                rows={isModal ? 4 : 5}
                maxLength={2000}
                disabled={submitting || hasPending}
                required
              />
            </div>
            {!isModal ? (
              <p className="profileFeedbackHint">
                Share your experience using the site. If your feedback passes the
                admin&apos;s review, you will receive {FEEDBACK_REWARD_RAC} RAC as
                compensation.
              </p>
            ) : null}
          </div>

          {hasPending ? (
            <p className="profileFeedbackNotice">
              You already have feedback awaiting review. Please wait before
              submitting again.
            </p>
          ) : null}

          {error ? <p className="profileFeedbackError">{error}</p> : null}
          {success ? <p className="profileFeedbackSuccess">{success}</p> : null}

          <button
            className={`btn${isModal ? " profileFeedbackSubmitBtn" : " profileSaveBtn"}`}
            type="submit"
            disabled={submitting || hasPending || !message.trim()}
          >
            {isModal ? (
              <>
                <span className="profileFeedbackSubmitBtnMain">
                  {submitting ? "Submitting..." : "Submit feedback"}
                </span>
                {!submitting ? (
                  <span className="profileFeedbackSubmitBtnReward">
                    +{FEEDBACK_REWARD_RAC} RAC
                  </span>
                ) : null}
                {!submitting ? (
                  <svg
                    className="profileFeedbackSubmitBtnIcon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      d="M4 12h12"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    <path
                      d="m13 7 5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </>
            ) : submitting ? (
              "Submitting..."
            ) : (
              "Submit feedback"
            )}
          </button>
        </div>
      </form>

      <div className="profileFeedbackHistory">
        <h3 className="profileFeedbackHistoryTitle">Your submissions</h3>
        {loading ? (
          <p className="profileFeedbackHint">Loading feedback...</p>
        ) : items.length === 0 ? (
          <p className="profileFeedbackHint">
            No feedback submitted yet. Share your thoughts to help us improve.
          </p>
        ) : (
          <div className="profileFeedbackHistoryList">
            {items.map((item) => (
              <article key={item.id} className="profileFeedbackHistoryItem">
                <div className="profileFeedbackHistoryHeader">
                  <span
                    className={`profileFeedbackStatus profileFeedbackStatus${item.status}`}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                  <time className="profileFeedbackHistoryDate">
                    {formatDate(item.createdAt)}
                  </time>
                </div>
                {item.subject ? (
                  <p className="profileFeedbackHistorySubject">{item.subject}</p>
                ) : null}
                <p className="profileFeedbackHistoryMessage">{item.message}</p>
                {item.status === "approved" ? (
                  <p className="profileFeedbackReward">
                    Compensation credited: {item.rewardAmount} RAC
                  </p>
                ) : null}
                {item.adminNote ? (
                  <p className="profileFeedbackAdminNote">
                    Admin note: {item.adminNote}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
