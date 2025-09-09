// ==UserScript==
// @name         Jira Epic Color Picker
// @namespace    https://github.com/scharinger/userscripts
// @version      1.4
// @description  Replace Jira’s epic color 'ghx-label-#' with a color picker
// @author       Tim Scharinger
// @match        https://*/issues/*
// @icon         https://www.atlassian.com/favicon.ico
// @homepageURL  https://github.com/scharinger/userscripts
// @supportURL   https://github.com/scharinger/userscripts/issues/new?labels=bug&projects=scharinger/2
// @updateURL    https://raw.githubusercontent.com/scharinger/userscripts/main/scripts/jira-epic-color-picker.js
// @downloadURL  https://raw.githubusercontent.com/scharinger/userscripts/main/scripts/jira-epic-color-picker.js
// @donate       https://ko-fi.com/scharinger
// @grant        none
// ==/UserScript==


(function () {
  "use strict";

  const PREFIX = '[Epic Color Picker]';

  // Configuration
  const CONFIG = {
    // Map of ghx-label-X to color CSS properties (using Jira's CSS custom properties)
    EPIC_COLORS: {
      "ghx-label-0": { color: "var(--ds-background-accent-gray-bolder, #6b778c)", textColor: "var(--ds-text-inverse, #fff)" },
      "ghx-label-1": { color: "var(--ds-background-accent-orange-bolder, #8d542e)", textColor: "var(--ds-text-inverse, #fff)" },
      "ghx-label-2": { color: "var(--ds-background-accent-orange-subtle, #ff8b00)", textColor: "var(--ds-text-accent-orange-bolder, #172b4d)" },
      "ghx-label-3": { color: "var(--ds-background-accent-yellow-subtle, #ffc400)", textColor: "var(--ds-text-accent-yellow-bolder, #172b4d)" },
      "ghx-label-4": { color: "var(--ds-background-accent-blue-bolder, #0747a6)", textColor: "var(--ds-text-inverse, #fff)" },
      "ghx-label-5": { color: "var(--ds-text-accent-gray-bolder, #253858)", textColor: "var(--ds-text-inverse, #fff)" },
      "ghx-label-6": { color: "var(--ds-background-accent-green-subtler, #57d9a3)", textColor: "var(--ds-text-accent-green-bolder, #172b4d)" },
      "ghx-label-7": { color: "var(--ds-background-accent-magenta-bolder, #b93d9e)", textColor: "var(--ds-text-inverse, #fff)" },
      "ghx-label-8": { color: "var(--ds-background-accent-purple-bolder, #5243aa)", textColor: "var(--ds-text-inverse, #fff)" },
      "ghx-label-9": { color: "var(--ds-background-accent-red-subtler, #ff8f73)", textColor: "var(--ds-text-accent-red-bolder, #172b4d)" },
      "ghx-label-10": { color: "var(--ds-background-accent-blue-subtler, #0065ff)", textColor: "var(--ds-text-accent-blue-bolder, #fff)" },
      "ghx-label-11": { color: "var(--ds-background-accent-teal-bolder, #008299)", textColor: "var(--ds-text-inverse, #fff)" },
      "ghx-label-12": { color: "var(--ds-background-accent-gray-bolder, #5e6c84)", textColor: "var(--ds-text-inverse, #fff)" },
      "ghx-label-13": { color: "var(--ds-background-accent-green-bolder, #00875a)", textColor: "var(--ds-text-inverse, #fff)" },
      "ghx-label-14": { color: "var(--ds-background-accent-red-bolder, #de350b)", textColor: "var(--ds-text-inverse, #fff)" },
    },
    API_ENDPOINT: "/rest/greenhopper/1.0/xboard/issue/update-field.json",
    FIELD_ID: "customfield_10003",
    EPIC_NAME_FIELD: "customfield_10002",
    DROPDOWN_STYLES: {
      width: "90px",
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
    getTextColor: (_, label) => {
      // First try to get text color from the epic colors config
      if (label) {
        const colorInfo = CONFIG.EPIC_COLORS[label];
        if (colorInfo && colorInfo.textColor) {
          return colorInfo.textColor;
        }
      }
      
      // Fallback for undefined colors
      return "var(--ds-text, #172b4d)";
    },
    getColorInfo: (label) => {
      // Handle empty or whitespace-only labels
      if (!label || label.trim() === "") {
        return { color: "var(--ds-background-neutral, #ccc)", textColor: "var(--ds-text, #000)" };
      }
      return CONFIG.EPIC_COLORS[label] || { color: "var(--ds-background-neutral, #ccc)", textColor: "var(--ds-text, #000)" };
    },
    generateId: () =>
      `epic-color-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
    logSuccess: (message, data) => console.log(`${PREFIX} ✅ ${message}`, data),
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
    isEpicIssue: (row) => {
      // Check for epic indicators in the row
      // 1. Look for epic type icon
      const epicIcon = row.querySelector("img[alt*='Epic'], img[title*='Epic'], .aui-icon-epic, [data-issue-type*='epic']");
      if (epicIcon) return true;
      
      // 2. Check if issue type column contains "Epic"
      const issueTypeCell = row.querySelector("td.issuetype, td[data-field-id='issuetype']");
      if (issueTypeCell && issueTypeCell.textContent.toLowerCase().includes("epic")) return true;
      
      // 3. Check for epic-specific CSS classes
      if (row.classList.contains("epic") || row.querySelector(".epic")) return true;
      
      // 4. Check data attributes
      const issueType = row.getAttribute("data-issue-type");
      if (issueType && issueType.toLowerCase().includes("epic")) return true;
      
      // 5. If there's already an epic color value, it's probably an epic
      const epicColorCell = row.querySelector(`td.${CONFIG.FIELD_ID}, td[data-field-id='${CONFIG.FIELD_ID}']`);
      if (epicColorCell && epicColorCell.textContent.trim() && 
          CONFIG.EPIC_COLORS[epicColorCell.textContent.trim()]) {
        return true;
      }
      
      return false;
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
        undefinedOption.style.setProperty('background-color', 'var(--ds-background-neutral, #ccc)', 'important');
        undefinedOption.style.setProperty('color', 'var(--ds-text, #000)', 'important');
        undefinedOption.selected = true;
        dropdown.appendChild(undefinedOption);
      }

      // Populate options
      Object.entries(CONFIG.EPIC_COLORS).forEach(([labelKey, colorData]) => {
        const option = document.createElement("option");
        option.value = labelKey;
        option.textContent = labelKey; // Show the ghx-label-# identifier for communication
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
        () => this.confirmChange(selectedLabel),
        () => this.cancelChange()
      );
    }

    async confirmChange(selectedLabel) {
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
          `${issueKey} epic color updated`
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

        // Only add color picker for epic issues
        if (!Selectors.isEpicIssue(row)) return;

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
