// ==UserScript==
// @name         SD Worx / Aditro - Flex Fix
// @namespace    https://github.com/scharinger/userscripts
// @version      2.2
// @description  Format flex time entries in the calendar view for better readability and log total flex hours in the console.
// @author       Tim Scharinger
// @match        https://hr.aditro.com/*
// @donate       https://ko-fi.com/scharinger
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const STYLE = {
        IN:  { color: "#155724", bg: "#d4edda", border: "#c3e6cb", label: "Flex in" },
        OUT: { color: "#721c24", bg: "#f8d7da", border: "#f5c6cb", label: "Flex out" }
    };

    window.runCalendarFix = function() {
        const transactions = document.querySelectorAll('.calendar-day-transaction');
        if (!transactions.length) return;

        let totalFlex = 0;
        const data = [];

        transactions.forEach(tr => {
            const infoTextEl = tr.querySelector('.information-string-text');
            if (!infoTextEl) return;

            const originalText = infoTextEl.innerText || "";
            const isFlexIn = originalText.includes("376");
            const isFlexOut = originalText.includes("377");

            if (isFlexIn || isFlexOut) {
                const config = isFlexIn ? STYLE.IN : STYLE.OUT;

                // 1. EXTRACT HOURS
                const matches = originalText.match(/(\d+[.,]\d+)|(\d+)/g);
                const val = matches ? parseFloat(matches[matches.length - 1].replace(',', '.')) : 0;

                // 2. UPDATE TEXT IN THE CALENDAR
                // Converts "FLEXIBLE WORKING HOURS OUT 377 1.50 Hours" -> "Flex out 1.50 h"
                infoTextEl.innerText = `${config.label} ${val.toFixed(2)} h`;

                // 3. STYLE THE BOX
                const body = tr.querySelector('.transaction-body');
                if (body) {
                    body.style.setProperty('background-color', config.bg, 'important');
                    body.style.setProperty('color', config.color, 'important');
                    body.style.setProperty('border', `1px solid ${config.border}`, 'important');
                    body.style.setProperty('background-image', 'none', 'important');
                    body.style.setProperty('padding', '2px 5px', 'important'); // Slightly more compact
                }

                tr.style.setProperty('border-left', `5px solid ${isFlexIn ? '#28a745' : '#dc3545'}`, 'important');

                // 4. COLLECT DATA FOR THE CONSOLE
                const dayContainer = tr.closest('calendar-day');
                let dayNum = "??";
                if (dayContainer) {
                    const dateEl = dayContainer.querySelector('.calendar-day-date span:first-child');
                    if (dateEl) dayNum = dateEl.innerText.trim();
                }

                if (isFlexOut) totalFlex -= val;
                else totalFlex += val;

                data.push({ Day: dayNum, Type: config.label, Hours: val.toFixed(2) });
            }
        });

        if (data.length > 0) {
            console.clear();
            const logColor = totalFlex >= 0 ? '#28a745' : '#dc3545';
            console.log(`%c TOTAL FLEX: ${totalFlex.toFixed(2)}h `,
                        `background: ${logColor}; color: white; font-size: 16px; font-weight: bold; padding: 5px; border-radius: 3px;`);
            console.table(data);
        }
    };

    setInterval(window.runCalendarFix, 3000);
})();