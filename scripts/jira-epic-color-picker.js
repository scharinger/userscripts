// ==UserScript==
// @name         Jira Epic Color Picker
// @namespace    https://github.com/scharinger/userscripts
// @version      1.0
// @description  Replace Jira’s epic color 'ghx-label-#' with a color picker
// @author       Tim Scharinger
// @match        https://*/issues/*
// @icon         https://www.atlassian.com/favicon.ico
// @homepageURL  https://github.com/scharinger/userscripts
// @supportURL   https://github.com/scharinger/userscripts/issues
// @donate       https://ko-fi.com/scharinger
// @grant        none
// ==/UserScript==


(function () {
  "use strict";

  // Configuration
  const CONFIG = {
    // Map of ghx-label-X to color hex and names (Jira's default epic colors)
    EPIC_COLORS: {
      "ghx-label-1": { color: "#8d542e", textColor: "#fff", name: "Brown" },
      "ghx-label-2": { color: "#ff8b00", textColor: "#172b4d", name: "Orange" },
      "ghx-label-3": { color: "#ffc400", textColor: "#172b4d", name: "Yellow" },
      "ghx-label-4": { color: "#0747a6", textColor: "#fff", name: "Dark Blue" },
      "ghx-label-5": { color: "#253858", textColor: "#fff", name: "Dark Grey" },
      "ghx-label-6": { color: "#57d9a3", textColor: "#172b4d", name: "Light Green" },
      "ghx-label-7": { color: "#b93d9e", textColor: "#fff", name: "Magenta" },
      "ghx-label-8": { color: "#5243aa", textColor: "#fff", name: "Purple" },
      "ghx-label-9": { color: "#ff8f73", textColor: "#172b4d", name: "Light Red" },
      "ghx-label-10": { color: "#0065ff", textColor: "#fff", name: "Blue" },
      "ghx-label-11": { color: "#008299", textColor: "#fff", name: "Dark Teal" },
      "ghx-label-12": { color: "#5e6c84", textColor: "#fff", name: "Grey" },
      "ghx-label-13": { color: "#00875a", textColor: "#fff", name: "Green" },
      "ghx-label-14": { color: "#de350b", textColor: "#fff", name: "Red" },
    },
    API_ENDPOINT: "/rest/greenhopper/1.0/xboard/issue/update-field.json",
    FIELD_ID: "customfield_10003",
    EPIC_NAME_FIELD: "customfield_10002",
    DROPDOWN_STYLES: {
      width: "86px",
      fontSize: "11px",
      border: "1px solid #888",
      borderRadius: "3px",
      padding: "1px 3px",
      textAlign: "center",
      display: "inline-block",
      marginLeft: "0px",
    },
  };

  // Utilities
  const Utils = {
    hexToRgb: (hex) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : null;
    },
    getLuminance: (r, g, b) => {
      const [rs, gs, bs] = [r, g, b].map(c => {
        c = c / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    },
    getTextColor: (bgColor, label) => {
      // First try to get text color from the epic colors config
      if (label) {
        const colorInfo = CONFIG.EPIC_COLORS[label];
        if (colorInfo && colorInfo.textColor) {
          return colorInfo.textColor;
        }
      }
      
      // Fallback to luminance calculation
      const rgb = Utils.hexToRgb(bgColor);
      if (!rgb) return "#fff";
      const luminance = Utils.getLuminance(rgb.r, rgb.g, rgb.b);
      return luminance > 0.5 ? "#172b4d" : "#fff";
    },
    getColorInfo: (label) => {
      // Handle empty or whitespace-only labels
      if (!label || label.trim() === "") {
        return { color: "#ccc", textColor: "#000", name: "Undefined" };
      }
      return CONFIG.EPIC_COLORS[label] || { color: "#ccc", textColor: "#000", name: "Unknown" };
    },
    generateId: () =>
      `epic-color-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    logSuccess: (message, data) => console.log(`[TM] ✅ ${message}`, data),
    showNotification: (title, body) => {
      if (window.AJS && window.AJS.flag) {
        window.AJS.flag({
          type: "success",
          title: title,
          body: body,
          close: "auto",
        });
      }
    },
  };

  // DOM Selectors
  const Selectors = {
    findEpicColorColumn: () => {
      const headerCells = Array.from(
        document.querySelectorAll("th, .ghx-column-header")
      );
      return headerCells.find((th) =>
        th.textContent.trim().toLowerCase().includes("epic color")
      );
    },
    getColumnIndex: (header, headerCells) => headerCells.indexOf(header),
    getTableRows: () => document.querySelectorAll("tbody tr"),
    getIssueKey: (row) => row.getAttribute("data-issuekey"),
    getIssueSummary: (row) => {
      const summaryCell = row.querySelector("td.summary a");
      return summaryCell ? summaryCell.textContent.trim() : "";
    },
    getEpicName: (row) => {
      const epicNameCell =
        row.querySelector(`td.${CONFIG.EPIC_NAME_FIELD}`) ||
        row.querySelector(`td[data-field-id='${CONFIG.EPIC_NAME_FIELD}']`);
      return epicNameCell ? epicNameCell.textContent.trim() : null;
    },
  };

  // Dropdown Creator
  class DropdownCreator {
    static create(currentLabel) {
      const colorInfo = Utils.getColorInfo(currentLabel);
      const dropdown = document.createElement("select");
      dropdown.className = "epic-color-dropdown";

      // Apply styles
      Object.assign(dropdown.style, CONFIG.DROPDOWN_STYLES);
      dropdown.style.setProperty('background-color', colorInfo.color, 'important');
      dropdown.style.setProperty('color', Utils.getTextColor(colorInfo.color, currentLabel), 'important');

      // Add "Undefined" option for empty values
      if (!currentLabel || currentLabel === "") {
        const undefinedOption = document.createElement("option");
        undefinedOption.value = "";
        undefinedOption.textContent = "Undefined";
        undefinedOption.style.setProperty('background-color', '#ccc', 'important');
        undefinedOption.style.setProperty('color', '#000', 'important');
        undefinedOption.selected = true;
        dropdown.appendChild(undefinedOption);
      }

      // Populate options
      Object.entries(CONFIG.EPIC_COLORS).forEach(([labelKey, colorData]) => {
        const option = document.createElement("option");
        option.value = labelKey;
        option.textContent = colorData.name;
        option.style.setProperty('background-color', colorData.color, 'important');
        option.style.setProperty('color', Utils.getTextColor(colorData.color, labelKey), 'important');

        if (labelKey === currentLabel) {
          option.selected = true;
        }

        dropdown.appendChild(option);
      });

      return dropdown;
    }

    static updateVisualState(dropdown, label) {
      const colorInfo = Utils.getColorInfo(label);
      dropdown.style.setProperty('background-color', colorInfo.color, 'important');
      dropdown.style.setProperty('color', Utils.getTextColor(colorInfo.color, label), 'important');
      dropdown.style.boxShadow = "";
      dropdown.style.borderColor = "#888";
    }

    static showPreview(dropdown, selectedLabel) {
      const colorInfo = Utils.getColorInfo(selectedLabel);
      dropdown.style.setProperty('background-color', colorInfo.color, 'important');
      dropdown.style.setProperty('color', Utils.getTextColor(colorInfo.color, selectedLabel), 'important');
      dropdown.style.boxShadow = `inset 0 0 0 999px rgba(255, 255, 255, 0.3)`;
      dropdown.style.borderColor = colorInfo.color;
    }
  }

  // Confirmation Dialog
  class ConfirmationDialog {
    constructor(issueKey, issueSummary, epicName, currentLabel, newLabel) {
      this.issueKey = issueKey;
      this.issueSummary = issueSummary;
      this.epicName = epicName || issueSummary || issueKey;
      this.currentColorInfo = Utils.getColorInfo(currentLabel);
      this.newColorInfo = Utils.getColorInfo(newLabel);
      this.dialogId = Utils.generateId();
      this.yesButtonId = `${this.dialogId}-yes`;
      this.noButtonId = `${this.dialogId}-no`;
      this.wasConfirmed = false;
      this.wasCancelled = false;
    }

    create() {
      const summaryText = this.issueSummary ? `: ${this.issueSummary}` : "";

      return AJS.dialog2(`
        <section role="dialog" id="${
          this.dialogId
        }" class="aui-layer aui-dialog2 aui-dialog2-medium" aria-hidden="true">
          <header class="aui-dialog2-header">
            <h2 class="aui-dialog2-title">Confirm Color Change</h2>
          </header>
          <div class="aui-dialog2-content">
            <p>Change epic color for <strong>${
              this.issueKey
            }</strong>${summaryText}:</p>
            <div style="display: flex; align-items: center; gap: 10px; margin: 10px 0;">
              ${this.createColorBox(this.currentColorInfo.color)}
              <span style="font-size: 16px;">→</span>
              ${this.createColorBox(this.newColorInfo.color)}
            </div>
          </div>
          <footer class="aui-dialog2-footer">
            <div class="aui-dialog2-footer-actions">
              <button id="${
                this.yesButtonId
              }" class="aui-button aui-button-primary">Yes</button>
              <button id="${
                this.noButtonId
              }" class="aui-button aui-button-link">Cancel</button>
            </div>
          </footer>
        </section>
      `);
    }

    createColorBox(color) {
      const textColor = Utils.getTextColor(color);
      const isEmpty = this.epicName === "";
      const sizeStyle = isEmpty ? "width: 20px; height: 20px;" : "";

      return `<div style="display: inline-block; ${sizeStyle}; padding: 1px 6px; background: ${color}; border: 1px solid #888; border-radius: 3px; color: ${textColor}; font-size: 11px; text-align: center;">${this.epicName}</div>`;
    }

    show(onConfirm, onCancel) {
      const dialog = this.create();
      dialog.show();

      // Handle dialog close (Escape key)
      dialog.on("hide", () => {
        if (!this.wasConfirmed && !this.wasCancelled) {
          onCancel();
        }
      });

      // Handle Yes button
      AJS.$(`#${this.yesButtonId}`).on("click", () => {
        this.wasConfirmed = true;
        dialog.hide();
        onConfirm();
      });

      // Handle Cancel button
      AJS.$(`#${this.noButtonId}`).on("click", () => {
        this.wasCancelled = true;
        dialog.hide();
        onCancel();
      });

      return dialog;
    }
  }

  // API Client
  class EpicColorAPI {
    static async updateColor(issueKey, newLabel) {
      const response = await fetch(CONFIG.API_ENDPOINT, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          issueIdOrKey: issueKey,
          fieldId: CONFIG.FIELD_ID,
          newValue: newLabel,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update epic color: ${response.statusText}`);
      }

      return response.json();
    }
  }

  // Main Epic Color Manager
  class EpicColorManager {
    constructor(row, cell, currentLabel) {
      this.row = row;
      this.cell = cell;
      this.currentLabel = currentLabel;
      this.dropdown = null;
      this.previousValue = currentLabel;
    }

    initialize() {
      this.dropdown = DropdownCreator.create(this.currentLabel);
      this.previousValue = this.dropdown.value;
      this.setupEventHandlers();
      this.insertIntoCell();
    }

    setupEventHandlers() {
      this.dropdown.addEventListener("change", () => this.handleColorChange());
    }

    async handleColorChange() {
      const selectedLabel = this.dropdown.value;
      const selectedColorInfo = Utils.getColorInfo(selectedLabel);

      // Show preview
      DropdownCreator.showPreview(this.dropdown, selectedLabel);

      // Get issue info
      const issueKey = Selectors.getIssueKey(this.row);
      const issueSummary = Selectors.getIssueSummary(this.row);
      const epicName = Selectors.getEpicName(this.row);

      // Show confirmation dialog
      const dialog = new ConfirmationDialog(
        issueKey,
        issueSummary,
        epicName,
        this.previousValue,
        selectedLabel
      );

      dialog.show(
        () => this.confirmChange(selectedLabel, selectedColorInfo),
        () => this.cancelChange()
      );
    }

    async confirmChange(selectedLabel, selectedColorInfo) {
      try {
        // Update visual state
        this.dropdown.value = selectedLabel;
        DropdownCreator.updateVisualState(this.dropdown, selectedLabel);

        // Make API call
        const issueKey = Selectors.getIssueKey(this.row);
        const data = await EpicColorAPI.updateColor(issueKey, selectedLabel);

        // Success feedback
        Utils.logSuccess("Epic color updated successfully:", data);
        Utils.showNotification(
          "Epic Color Updated",
          `${issueKey} color changed to ${selectedColorInfo.name}`
        );

        // Update tracking
        this.previousValue = selectedLabel;
      } catch (error) {
        alert("Failed to update epic color: " + error);
        this.cancelChange();
      }
    }

    cancelChange() {
      // Reset to previous selection
      this.dropdown.value = this.previousValue;
      DropdownCreator.updateVisualState(this.dropdown, this.previousValue);
    }

    insertIntoCell() {
      this.cell.textContent = "";
      this.cell.appendChild(this.dropdown);
    }
  }

  // Main Application
  class JiraEpicColorPicker {
    static addColorSelectors() {
      const epicColorHeader = Selectors.findEpicColorColumn();
      if (!epicColorHeader) return;

      const headerCells = Array.from(
        document.querySelectorAll("th, .ghx-column-header")
      );
      const colIndex = Selectors.getColumnIndex(epicColorHeader, headerCells);
      if (colIndex === -1) return;

      const rows = Selectors.getTableRows();
      rows.forEach((row) => {
        const cells = row.querySelectorAll("td");
        if (cells.length <= colIndex) return;

        const cell = cells[colIndex];
        if (cell.querySelector("select")) return; // Already processed

        const issueKey = Selectors.getIssueKey(row);
        if (!issueKey) return;

        const cellText = cell.textContent.trim();
        // Check if the cell contains a valid ghx-label or is empty/unknown
        const currentLabel = CONFIG.EPIC_COLORS[cellText] ? cellText : "";
        const manager = new EpicColorManager(row, cell, currentLabel);
        manager.initialize();
      });
    }

    static setupEventListeners() {
      // Initial load
      setTimeout(() => JiraEpicColorPicker.addColorSelectors(), 1500);

      // Navigation events
      document.addEventListener(
        "pjax:end",
        JiraEpicColorPicker.addColorSelectors
      );
      document.addEventListener(
        "DOMContentLoaded",
        JiraEpicColorPicker.addColorSelectors
      );

      // AJAX request intercepting
      JiraEpicColorPicker.interceptXHR();
      JiraEpicColorPicker.interceptFetch();

      // DOM mutation observer
      JiraEpicColorPicker.setupMutationObserver();

      // Fallback polling
      setInterval(JiraEpicColorPicker.addColorSelectors, 5000);
    }

    static interceptXHR() {
      const originalOpen = XMLHttpRequest.prototype.open;
      XMLHttpRequest.prototype.open = function (_, url) {
        const result = originalOpen.apply(this, arguments);
        if (url.includes("/rest/") || url.includes("filter")) {
          this.addEventListener("load", () => {
            setTimeout(JiraEpicColorPicker.addColorSelectors, 500);
          });
        }
        return result;
      };
    }

    static interceptFetch() {
      const originalFetch = window.fetch;
      window.fetch = function () {
        const result = originalFetch.apply(this, arguments);
        result
          .then(() => {
            setTimeout(JiraEpicColorPicker.addColorSelectors, 500);
          })
          .catch(() => {
            setTimeout(JiraEpicColorPicker.addColorSelectors, 500);
          });
        return result;
      };
    }

    static setupMutationObserver() {
      const observer = new MutationObserver((mutations) => {
        let shouldRun = false;
        mutations.forEach((mutation) => {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            for (let node of mutation.addedNodes) {
              if (
                node.nodeType === 1 &&
                (node.matches("tr, tbody, table") ||
                  node.querySelector("tr, tbody, table"))
              ) {
                shouldRun = true;
                break;
              }
            }
          }
        });
        if (shouldRun) {
          setTimeout(JiraEpicColorPicker.addColorSelectors, 300);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });
    }

    static initialize() {
      JiraEpicColorPicker.setupEventListeners();
    }
  }

  // Inject CSS to override select hover behavior
  const style = document.createElement('style');
  style.textContent = `
    select.epic-color-dropdown:hover {
      box-shadow: inset 0 0 0 999px rgba(255, 255, 255, 0.3) !important;
    }
    select.epic-color-dropdown:focus {
      outline: 2px solid #0065ff !important;
      outline-offset: 1px !important;
    }
  `;
  document.head.appendChild(style);

  // Start the application
  JiraEpicColorPicker.initialize();
})();
