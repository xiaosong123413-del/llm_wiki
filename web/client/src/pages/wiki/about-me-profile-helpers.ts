/**
 * Shared rendering helpers for the dedicated about-me profile page.
 */

import type { AboutMeField } from "./about-me-profile-markdown.js";

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return character;
    }
  });
}

export function formatDateTime(value: string): string {
  if (!value) {
    return "未记录";
  }
  return new Date(value).toLocaleString();
}

export function wikiHref(path: string): string {
  return `#/wiki/${encodeURIComponent(path)}`;
}

export function renderTag(value: string): string {
  return `<span class="about-me-profile__tag">${escapeHtml(value)}</span>`;
}

export function renderStatCard(field: AboutMeField): string {
  return `
    <article class="about-me-profile__stat" data-about-me-stat="${escapeHtml(field.label)}">
      <strong>${escapeHtml(field.value)}</strong>
      <span>${escapeHtml(field.label)}</span>
    </article>
  `;
}

export function renderFieldRow(field: AboutMeField): string {
  return `<div class="about-me-profile__field-row"><span>${escapeHtml(field.label)}</span><strong>${escapeHtml(field.value)}</strong></div>`;
}

export function renderPlainRow(value: string): string {
  return `<div class="about-me-profile__plain-row">${escapeHtml(value)}</div>`;
}
