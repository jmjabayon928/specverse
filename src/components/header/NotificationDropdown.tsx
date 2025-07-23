// src/components/header/NotificationDropdown.tsx
"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { RawNotification, Notification } from "@/types/notification";

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const router = useRouter();

  const handleNotificationClick = async (note: Notification) => {
    try {
      setNotifications((prev) =>
        prev.map((n) =>
          n.notificationId === note.notificationId ? { ...n, isRead: true } : n
        )
      );

      await fetch(`/api/backend/notifications/${note.notificationId}/read`, {
        method: "PATCH",
        credentials: "include",
      });
    } catch (err) {
      console.error("Failed to mark notification as read", err);
    }

    if (note.link) {
      router.push(note.link);
    }
  };

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch("/api/backend/notifications", {
          credentials: "include",
        });

        if (!res.ok) {
          console.error("Failed to fetch: ", await res.text());
          return;
        }

        const data = await res.json();
        if (!Array.isArray(data)) {
          console.error("Expected an array but got:", data);
          return;
        }

        const mapped: Notification[] = data.map((n: RawNotification) => ({
          notificationId: n.NotificationID,
          sheetId: n.SheetID,
          sheetName: n.SheetName,
          title: n.Title,
          message: n.Message,
          link: n.Link?.startsWith("/") ? n.Link : `/${n.Link}`,
          category: n.Category,
          createdAt: n.CreatedAt,
          isRead: n.IsRead,
          senderName: n.SenderName,
          senderProfilePic: n.SenderProfilePic?.startsWith("/")
            ? n.SenderProfilePic
            : `/${n.SenderProfilePic}`,
        }));

        setNotifications(mapped);
      } catch (err) {
        console.error("Failed to fetch notifications", err);
      }
    }

    fetchNotifications();
  }, []);

  const hasUnread = notifications.some((n) => !n.isRead);

  const toggleDropdown = () => {
    setIsOpen(!isOpen);
  };

  const closeDropdown = () => {
    setIsOpen(false);
  };

  const groupedByCategory = notifications.reduce((acc, note) => {
    const key = note.category || "Other";
    if (!acc[key]) acc[key] = [];
    acc[key].push(note);
    return acc;
  }, {} as Record<string, Notification[]>);

  return (
    <div className="relative">
      <button
        className="relative dropdown-toggle flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        title="Notification"
        onClick={toggleDropdown}
      >
        {hasUnread && (
          <span className="absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400">
            <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping"></span>
          </span>
        )}
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute -right-[240px] mt-[17px] flex h-[480px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0"
      >
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
          <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
            Notification
          </h5>
        </div>

        <div className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
          {notifications.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-4">
              No notifications
            </div>
          ) : (
            ["Template", "Datasheet", "Estimation", "Inventory", "Other"]
              .filter((cat) => groupedByCategory[cat])
              .map((category) => (
                <div key={category} className="mb-2">
                  <h6 className="px-4 py-2 text-sm font-semibold text-gray-500 uppercase">
                    {category}
                  </h6>
                  <ul>
                    {groupedByCategory[category].map((note) => (
                      <li key={note.notificationId}>
                        <DropdownItem
                          onItemClick={() => handleNotificationClick(note)}
                          className={`flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 ${
                            note.isRead
                              ? "bg-white text-gray-500"
                              : "bg-yellow-50 font-semibold"
                          }`}
                        >
                          <span className="relative block w-full h-10 rounded-full z-1 max-w-10">
                            <Image
                              width={40}
                              height={40}
                              src={
                                note.senderProfilePic ||
                                "/images/user/user-default.png"
                              }
                              alt="User"
                              className="w-full overflow-hidden rounded-full"
                            />
                          </span>
                          <span className="block">
                            <span className="mb-1.5 space-x-1 block text-theme-sm text-gray-500 dark:text-gray-400">
                              <span className="font-medium text-gray-800 dark:text-white/90">
                                {note.senderName}
                              </span>{" "}
                              {note.link ? (
                                <a href={note.link} className="text-blue-600 hover:underline">
                                  {note.message}
                                </a>
                              ) : note.sheetId && note.category === "Template" ? (
                                <a
                                  href={`/datasheets/templates/${note.sheetId}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {note.message || `New Template: ${note.sheetName}`}
                                </a>
                              ) : note.sheetId && note.category === "Datasheet" ? (
                                <a
                                  href={`/datasheets/filled/${note.sheetId}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {note.message || `New Datasheet: ${note.sheetName}`}
                                </a>
                              ) : note.category === "Estimation" && typeof note.sheetId === "number" ? (
                                <a
                                  href={`/estimation/${note.sheetId}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {note.message || `New Estimation`}
                                </a>
                              ) : note.sheetId && note.category === "Inventory" ? (
                                <a
                                  href={`/inventory/item/${note.sheetId}`}
                                  className="text-blue-600 hover:underline"
                                >
                                  {note.message || `Inventory Updated`}
                                </a>
                              ) : (
                                <span>{note.message}</span>
                              )}
                            </span>
                            <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                              <span>{note.category}</span>
                              <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                              <span>
                                {new Date(note.createdAt).toLocaleString()}
                              </span>
                            </span>
                          </span>
                        </DropdownItem>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
          )}
        </div>

        <Link
          href="/notifications"
          className="block px-4 py-2 mt-3 text-sm font-medium text-center text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
        >
          View All Notifications
        </Link>
      </Dropdown>
    </div>
  );
}
