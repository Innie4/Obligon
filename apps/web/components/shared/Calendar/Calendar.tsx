"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

type CalendarMode = "month" | "range";

interface CalendarProps {
  mode: CalendarMode;
  selectedDates: Date[] | null;
  onDateSelect: (date: Date) => void;
  onRangeSelect: (start: Date, end: Date) => void;
  disabledDates?: Date[];
  label?: string;
}

const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function Calendar({ mode, selectedDates, onDateSelect, onRangeSelect, disabledDates, label }: CalendarProps) {
  const [currentYear, setCurrentYear] = React.useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = React.useState(new Date().getMonth());
  const [hoverDate, setHoverDate] = React.useState<Date | null>(null);

  const handleDateClick = (date: Date) => {
    if (mode === "range") {
      if (!selectedDates || selectedDates.length < 2) {
        onDateSelect(date);
      } else if (selectedDates.length === 1) {
        // Ensure start date is before end date
        if (date < selectedDates[0]) {
          onRangeSelect(date, selectedDates[0]);
        } else {
          onRangeSelect(selectedDates[0], date);
        }
      } else {
        // Reset selection
        onDateSelect(date);
      }
    } else {
      onDateSelect(date);
    }
  };

  const prevMonth = () => setCurrentMonth((currentMonth - 1 + 12) % 12);
  const nextMonth = () => setCurrentMonth((currentMonth + 1) % 12);
  const prevYear = () => setCurrentYear(currentYear - 1);
  const nextYear = () => setCurrentYear(currentYear + 1);

  const year = currentYear;
  const month = currentMonth;
  const totalDays = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const renderDay = (day: number, date: Date) => {
    const isSelected = selectedDates
      ? mode === "range"
        ? selectedDates[0] <= date && date <= selectedDates[1]
        : selectedDates.some(d => d.getDate() === day && d.getMonth() === month && d.getFullYear() === year)
      : false;
    const isHover = hoverDate && hoverDate.getDate() === day && hoverDate.getMonth() === month && hoverDate.getFullYear() === year;
    const isDisabled = disabledDates?.some(d => d.getDate() === day && d.getMonth() === month && d.getFullYear() === year);
    
    return (
      <div
        key={day}
        className={`cursor-pointer select-none rounded-full px-2 py-1 ${
          isSelected ? "bg-obligon-green text-white" :
          isHover ? "bg-obligon-lime/20" : "text-obligon-text"
        } ${isDisabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={() => handleDateClick(new Date(year, month, day))}
        onMouseOver={() => setHoverDate(new Date(year, month, day))}
        onMouseOut={() => setHoverDate(null)}
        title={isDisabled ? "Disabled" : undefined}
      >
        {day}
      </div>
    );
  };

  // Generate calendar days
  const days: (string | React.ReactNode)[] = [];

  // Previous month days
  for (let i = 0; i < firstDay; i++) {
    days.push(<div key={i} className="select-none h-6 w-6 opacity-0" />);
  }

  // Current month days
  for (let day = 1; day <= totalDays; day++) {
    days.push(renderDay(day, new Date(year, month, day)));
  }

  // Next month days to fill the grid
  const totalCells = 35 - days.length; // 35 = 5 weeks * 7 days
  for (let i = 0; i < totalCells; i++) {
    days.push(<div key={i} className="select-none h-6 w-6 opacity-0" />);
  }

  return (
    <div className="w-full max-w-md">
      <div className="mb-4">
        <button
          onClick={prevMonth}
          className="rounded-l bg-obligon-mist p-1 text-obligon-text"
          aria-label="Previous month"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.66 5.33a1 1 0 011.41 0L14.66 10l4.34-4.33a1 1 0 111.72 1.42L10 14.66l-5.34 5.33a1 1 0 01-1.41 0L5.33 10 1.06 5.33a1 1 0 010-1.42L10 5.33z" />
          </svg>
        </button>
        <span className="mx-2 font-bold text-obligon-navy">
          {months[currentMonth]} {currentYear}
        </span>
        <button
          onClick={nextMonth}
          className="rounded-r bg-obligon-mist p-1 text-obligon-text"
          aria-label="Next month"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9.66 14.67a1 1 0 011.41 0L14.66 10l4.34 4.33a1 1 0 111.72-1.42L10 5.34l-5.34-5.33a1 1 0 01-1.41 0L10 10l5.34 5.33a1 1 0 011.41 0l4.33-4.33a1 1 0 010 1.42L14.66 15z" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7">
        {daysOfWeek.map((day) => (
          <div key={day} className="text-xs font-bold text-obligon-text text-center py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 mt-2">
        {days}
      </div>
    </div>
  );
}