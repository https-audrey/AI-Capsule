import { useState } from "react";

export default function ConfirmDeleteModal({ capsule, onConfirm, onCancel }) {
  const [deleting, setDeleting] = useState(false);

  async function handleConfirm() {
    setDeleting(true);
    try {
      await onConfirm(capsule);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !deleting) onCancel();
      }}
    >
      <div
        className="modal confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Delete capsule confirmation"
      >
        <div className="confirm-icon" aria-hidden="true">!</div>
        <h2>Delete capsule?</h2>
        <p className="confirm-message">
          Are you sure you want to delete <strong>"{capsule.prompt_title}"</strong>
          {capsule.prompt_version ? ` (${capsule.prompt_version})` : ""}? This action cannot be undone.
        </p>
        <div className="button-row confirm-actions">
          <button
            type="button"
            className="secondary"
            onClick={onCancel}
            disabled={deleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="danger-solid"
            onClick={handleConfirm}
            disabled={deleting}
          >
            {deleting ? "Deleting..." : "Delete capsule"}
          </button>
        </div>
      </div>
    </div>
  );
}
