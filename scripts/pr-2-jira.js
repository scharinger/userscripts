// ==UserScript==
// @name         PR-2-Jira: GitHub & Jira Integration
// @namespace    https://github.com/scharinger/userscripts
// @version      2.3
// @description  Seamlessly connect GitHub PRs to Jira with smart button placement and automatic link creation
// @author       Tim Scharinger
// @match        https://*/*/pull/*
// @match        https://*/browse/*
// @icon         https://github.com/favicon.ico
// @homepageURL  https://github.com/scharinger/userscripts
// @supportURL   https://github.com/scharinger/userscripts/issues/new?labels=bug&projects=scharinger/3
// @updateURL    https://raw.githubusercontent.com/scharinger/userscripts/main/scripts/pr-2-jira-combined.js
// @downloadURL  https://raw.githubusercontent.com/scharinger/userscripts/main/scripts/pr-2-jira-combined.js
// @donate       https://ko-fi.com/scharinger
// @grant        none
// ==/UserScript==

;(() => {
  'use strict'

  const PREFIX = '[PR-2-Jira]'

  // Simple settings management with localStorage
  const Settings = {
    get: (key, defaultValue) => {
      try {
        const stored = localStorage.getItem(`pr2jira_${key}`)
        return stored !== null ? JSON.parse(stored) : defaultValue
      } catch {
        return defaultValue
      }
    },
    set: (key, value) => {
      try {
        localStorage.setItem(`pr2jira_${key}`, JSON.stringify(value))
        return true
      } catch {
        return false
      }
    },
  }

  // Detect page type
  function detectPageType() {
    const hostname = window.location.hostname.toLowerCase()
    const pathname = window.location.pathname

    if (hostname.includes('github') && pathname.includes('/pull/')) {
      return 'github'
    } else if (hostname.includes('jira') && pathname.includes('/browse/')) {
      return 'jira'
    }
    return null
  }

  // GitHub functionality
  function initializeGitHubFeatures() {
    console.log(`${PREFIX} Starting GitHub script`)

    const jiraLinks = document.querySelectorAll('a[href*="/browse/"]')
    if (jiraLinks.length === 0) {
      console.warn(`${PREFIX} No Jira issue link found on this page.`)
      return
    }

    if (document.querySelector('.pr-2-jira-btn')) return

    const prUrl = window.location.href
    const linkPrefix = Settings.get('linkPrefix', 'Solves: Jira ')

    console.log(`${PREFIX} Retrieved linkPrefix: "${linkPrefix}"`)

    function createButton(jiraLink) {
      const button = document.createElement('button')
      button.className = 'pr-2-jira-btn btn btn-sm'
      button.textContent = '📌 Create PR link in Jira ↗️'
      button.style.marginLeft = '0.5em'
      button.title = 'Open the Jira issue and send this PR as a remote link'

      button.addEventListener('click', () => {
        const jiraUrl = `${jiraLink.href}?prLink=${encodeURIComponent(prUrl)}`
        window.open(jiraUrl, '_blank')
      })

      return button
    }

    function createSettingsButton() {
      const settingsBtn = document.createElement('button')
      settingsBtn.className = 'pr-2-jira-settings-btn btn btn-sm'
      settingsBtn.innerHTML = '⚙️'
      settingsBtn.style.cssText =
        'margin-left: 0.25em; padding: 2px 6px; font-size: 12px;'
      settingsBtn.title = 'PR-2-Jira Settings'

      settingsBtn.addEventListener('click', showSettingsDialog)
      return settingsBtn
    }

    function addButtonToLink(jiraLink) {
      const button = createButton(jiraLink)
      const settingsButton = createSettingsButton()

      jiraLink.parentNode.insertBefore(button, jiraLink.nextSibling)
      jiraLink.parentNode.insertBefore(settingsButton, button.nextSibling)
    }

    function hasValidPrefix(jiraLink, prefixRegex) {
      const container =
        jiraLink.closest('p, div, li, td, th, span, .comment-body') ||
        jiraLink.parentElement
      const textContent = container?.textContent || ''
      return prefixRegex.test(textContent)
    }

    let buttonsAdded = 0

    if (linkPrefix) {
      console.log(`${PREFIX} Looking for links with prefix: "${linkPrefix}"`)
      const escapedPrefix = linkPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const prefixRegex = new RegExp(`(^|\\s|[.,;:!?\\-])${escapedPrefix}`, 'i')

      jiraLinks.forEach((jiraLink) => {
        if (hasValidPrefix(jiraLink, prefixRegex)) {
          console.log(`${PREFIX} Adding button for: ${jiraLink.href}`)
          addButtonToLink(jiraLink)
          buttonsAdded++
        }
      })
    } else {
      console.log(`${PREFIX} No prefix configured, adding buttons to all links`)
      jiraLinks.forEach(addButtonToLink)
      buttonsAdded = jiraLinks.length
    }

    // If no buttons were added, add a standalone settings button
    if (buttonsAdded === 0) {
      console.log(
        `${PREFIX} No matching links found, adding standalone settings button`
      )
      addStandaloneSettingsButton()
    }
  }

  function addStandaloneSettingsButton() {
    // Add a small settings button in the top right corner when no PR buttons are shown
    const settingsButton = document.createElement('button')
    settingsButton.innerHTML = '⚙️'
    settingsButton.className = 'pr-2-jira-standalone-settings btn btn-sm'
    settingsButton.title = 'PR-2-Jira Settings (no matching Jira links found)'
    settingsButton.style.cssText = `
            position: fixed;
            bottom: 10px;
            left: 10px;
            z-index: 1000;
            background: #656d76;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 12px;
            opacity: 0.8;
        `

    settingsButton.addEventListener('click', showSettingsDialog)
    document.body.appendChild(settingsButton)
  }

  function showSettingsDialog() {
    const currentPrefix = Settings.get('linkPrefix', 'Solves: Jira ')
    const newPrefix = prompt('Enter Jira Link Prefix:', currentPrefix)

    if (newPrefix !== null && newPrefix !== currentPrefix) {
      Settings.set('linkPrefix', newPrefix)
      console.log(`${PREFIX} Settings saved: linkPrefix = "${newPrefix}"`)
      // Show confirmation
      const notification = document.createElement('div')
      notification.innerHTML =
        '✅ PR-2-Jira settings saved! Refreshing buttons...'
      notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: #238636;
                color: white;
                padding: 12px 16px;
                border-radius: 6px;
                z-index: 10000;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `
      document.body.appendChild(notification)
      // Remove existing buttons and standalone settings button
      document
        .querySelectorAll(
          '.pr-2-jira-btn, .pr-2-jira-settings-btn, .pr-2-jira-standalone-settings'
        )
        .forEach((btn) => {
          btn.remove()
        })
      // Re-run the GitHub script to apply new settings
      setTimeout(() => {
        console.log(
          `${PREFIX} Re-initializing GitHub features with new settings`
        )
        initializeGitHubFeatures()
        setTimeout(() => notification.remove(), 2000)
      }, 500)
    }
  }

  // Jira functionality
  function initializeJiraFeatures() {
    console.log(`${PREFIX} greeting from Jira`)

    const params = new URLSearchParams(window.location.search)
    const prLink = params.get('prLink')
    if (!prLink) {
      console.warn(`${PREFIX} No prLink parameter found in URL.`)
      return
    }
    const issueKey = window.location.pathname.split('/browse/')[1]
    if (!issueKey) {
      console.warn(`${PREFIX} No issue key found in URL path.`)
      showToast('PR Link', 'No Jira issue key found in URL.', 'warning')
      return
    }
    console.log(`${PREFIX} starting Jira functionality`, { issueKey, prLink })
    addPRLink(issueKey, prLink)
  }

  async function addPRLink(
    issueKey,
    url,
    title = 'PR',
    iconUrl = 'https://github.com/favicon.ico'
  ) {
    if (!issueKey || !url) return
    const jiraHost = 'https://jira.se.axis.com'
    try {
      console.log(`${PREFIX} Fetching existing remote links...`)
      const existingRes = await fetch(
        `${jiraHost}/rest/api/2/issue/${issueKey}/remotelink`,
        {
          headers: { Accept: 'application/json' },
          credentials: 'include',
        }
      )
      if (!existingRes.ok)
        throw new Error(
          `${PREFIX} Failed to fetch remote links: HTTP ${existingRes.status} ${existingRes.statusText}`
        )
      const existingLinks = await existingRes.json()
      console.log(`${PREFIX} Existing PR links:`, existingLinks)
      const exists = existingLinks.some((link) => link.object?.url === url)
      if (exists) {
        console.log(`${PREFIX} Link already exists on ${issueKey}: ${url}`)
        showToast('PR Link', 'Link already exists.', 'info', 3000)
        removePrLinkParam()
        return
      }
      console.log(`${PREFIX} Creating new PR link...`)
      const linkData = {
        object: { url, title, icon: { url16x16: iconUrl } },
      }
      const res = await fetch(
        `${jiraHost}/rest/api/2/issue/${issueKey}/remotelink`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(linkData),
        }
      )
      if (!res.ok) {
        const errorText = await res.text()
        throw new Error(
          `${PREFIX} Failed to create PR link: HTTP ${res.status} ${res.statusText} – ${errorText}`
        )
      }
      console.log(`${PREFIX} PR link created on ${issueKey}: ${url}`)
      showToast('PR Link', 'Link created.')
      removePrLinkParam()
      refreshLinksSection()
    } catch (err) {
      console.error(`${PREFIX} [ERROR]`, err)
      showToast(
        'PR Link',
        `Failed to create link: ${err.message || err}`,
        'error'
      )
    }
  }

  function showToast(title, body, type = 'success', autoCloseDelay = null) {
    if (window.AJS?.flag) {
      console.log(`${PREFIX} Using AJS.flag for notification`)
      const flagOptions = { title, body, type }
      if (autoCloseDelay) {
        flagOptions.close = 'auto'
        flagOptions.timeout = autoCloseDelay
      }
      const flag = window.AJS.flag(flagOptions)
      if (autoCloseDelay && flag && flag.close) {
        setTimeout(() => {
          try {
            flag.close()
            console.log(`${PREFIX} Auto-closed toast after ${autoCloseDelay}ms`)
          } catch (e) {
            console.log(`${PREFIX} Could not auto-close toast:`, e)
          }
        }, autoCloseDelay)
      }
    } else {
      console.log(`${PREFIX} AJS.flag not available`)
      console.log(`${PREFIX} [TOAST] ${type.toUpperCase()}: ${title} – ${body}`)
    }
  }

  function removePrLinkParam() {
    const url = new URL(window.location.href)
    if (url.searchParams.has('prLink')) {
      url.searchParams.delete('prLink')
      window.history.replaceState({}, document.title, url.toString())
      console.log(`${PREFIX} Removed prLink parameter from URL.`)
    }
  }

  function refreshLinksSection() {
    // Try to find and reload the links section
    const linksSection = document.querySelector(
      '[data-module-key="com.atlassian.jira.jira-view-issue-plugin:linkissue-web-panel"]'
    )
    if (linksSection) {
      console.log(`${PREFIX} Refreshing links section...`)
      // Trigger a re-render by dispatching a custom event
      window.dispatchEvent(new CustomEvent('jira:refresh-issue-links'))
      if (window.JIRA?.Issue?.refreshIssuePage) {
        setTimeout(() => window.JIRA.Issue.refreshIssuePage(), 1000)
      } else {
        setTimeout(() => window.location.reload(), 2000)
      }
    } else {
      console.log(`${PREFIX} Links section not found, will reload page...`)
      setTimeout(() => window.location.reload(), 1000)
    }
  }

  // Main initialization
  const pageType = detectPageType()
  console.log(`${PREFIX} Detected page type: ${pageType}`)
  if (pageType === 'github') {
    initializeGitHubFeatures()
  } else if (pageType === 'jira') {
    initializeJiraFeatures()
  } else {
    console.log(`${PREFIX} No matching page type found`)
  }
})()
