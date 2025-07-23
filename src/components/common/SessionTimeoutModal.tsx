"use client";

import React from "react";

interface Props {
  show: boolean;
  countdown: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

const SessionTimeoutModal: React.FC<Props> = ({
  show,
  countdown,
  onStayLoggedIn,
  onLogout,
}) => {
  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md text-center max-w-sm w-full">
        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-2">
          Session Expiring Soon
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          Your session will expire in <strong>{countdown}</strong> seconds.
          Would you like to stay logged in?
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={onStayLoggedIn}
            className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700"
          >
            Yes
          </button>
          <button
            onClick={onLogout}
            className="px-4 py-2 text-white bg-red-500 rounded hover:bg-red-600"
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionTimeoutModal;
