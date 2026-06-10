import type { Task } from "./types";

export function taskToIcs(task: Task, appUrl: string) {
  const start = task.due_date ? `${task.due_date.replaceAll("-", "")}T${(task.due_time || "09:00").replace(":", "")}00` : dateStamp(new Date());
  const endDate = new Date(`${task.due_date || new Date().toISOString().slice(0, 10)}T${task.due_time || "09:00"}:00`);
  endDate.setMinutes(endDate.getMinutes() + 30);
  const end = dateStamp(endDate);
  const lead = task.leads;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Muugiassistent//Followup//ET",
    "BEGIN:VEVENT",
    `UID:${task.id}@muugiassistent`,
    `DTSTAMP:${dateStamp(new Date())}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcs(`Müügiassistent: ${task.type}`)}`,
    `DESCRIPTION:${escapeIcs(`${lead?.property_address || ""}\\n${lead?.contact_name || ""} ${lead?.phone || ""}\\n${task.comment || ""}\\n${appUrl}`)}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].join("\r\n");
}

function dateStamp(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\n", "\\n").replaceAll(",", "\\,").replaceAll(";", "\\;");
}
