// NOTE: This script relies on the powerful chatgpt.js library @ https://chatgpt.js.org
// (c) 2023 KudoAI & contributors under the MIT license
// Source: https://github.com/kudoai/chatgpt.js
// Latest minified release: https://code.chatgptjs.org/chatgpt-latest.min.js

(async () => {

    // Import libs
    const { config, settings } = await import(chrome.runtime.getURL('lib/settings-utils.js')),
          { chatgpt } = await import(chrome.runtime.getURL('lib/chatgpt.js'))

    // Add Chrome msg listener
    let fromMsg = false // to prevent double notifications blocked by popup
    chrome.runtime.onMessage.addListener((request) => {
        fromMsg = true
        if (request.action === 'notify') notify(request.msg, request.position)
        else if (request.action === 'alert') alert(request.title, request.msg, request.btns)
        else if (request.action === 'updateToggleHTML') updateToggleHTML()
        else if (request.action === 'clickToggle') document.querySelector('#infToggleLabel').click()        
        else if (typeof window[request.action] === 'function') {
            const args = Array.isArray(request.args) ? request.args // preserve array if supplied
                       : request.args !== undefined ? [request.args] : [] // convert to array if single or no arg
            window[request.action](...args) // call expression functions
        }
        return true
    })

    function alert(title = '', msg = '', btns = '', checkbox = '', width = '') {
        return chatgpt.alert(`${ config.appSymbol } ${ title }`, msg, btns, checkbox, width )}

    // Selectively disable content or user script
    if (!window.location.href.startsWith('https://chat.openai.com')) return
    document.documentElement.setAttribute('cif-extension-installed', true) // for userscript auto-disable

    // Init settings
    settings.save('userLanguage', (await chrome.i18n.getAcceptLanguages())[0])
    settings.save('infinityMode', false) // to reset popup toggle
    settings.load(['autoScrollDisabled', 'replyInterval', 'replyLanguage', 'replyTopic', 'toggleHidden']).then(() => {
        if (!config.replyLanguage) settings.save('replyLanguage', config.userLanguage) // init reply language if unset
        if (!config.replyTopic) settings.save('replyTopic', 'ALL') // init reply topic if unset
        if (!config.replyInterval) settings.save('replyInterval', 7) // init refresh interval to 7 secs if unset
    })

    // Add listener to auto-disable Infinity Mode
    if (document.hidden !== undefined) { // ...if Page Visibility API supported
        document.addEventListener('visibilitychange', () => {
            if (config.infinityMode) infinityMode.deactivate()
    })}

    // Stylize toggle switch
    if (!document.getElementById('chatgpt-switch-style')) {
        const switchStyle = document.createElement('style')
        switchStyle.innerText = '.switch { position: absolute ; left: 208px ; width: 34px ; height: 18px } '
            + '.switch input { opacity: 0 ; width: 0 ; height: 0 } ' // hide checkbox
            + '.slider { position: absolute ; cursor: pointer ; top: 0 ; left: 0 ; right: 0 ; bottom: 0 ; '
                + 'background-color: #ccc ; -webkit-transition: .4s ; transition: .4s ; border-radius: 28px } '
            + '.slider:before { position: absolute ; content: "" ; height: 14px ; width: 14px ; left: 3px ; bottom: 2px ; '
                + 'background-color: white ; -webkit-transition: .4s ; transition: .4s ; border-radius: 28px } '

            // Position/color ON-state
            + 'input:checked { position: absolute ; right: 3px } '
            + 'input:checked + .slider { background-color: #42B4BF } '
            + 'input:checked + .slider:before { '
                + '-webkit-transform: translateX(14px) translateY(1px) ; '
                + '-ms-transform: translateX(14px) translateY(1px) ; '
                + 'transform: translateX(14px) }'

        document.head.appendChild(switchStyle)
    }

    // Create sidebar toggle, add styles/classes/listener/HTML
    const toggleLabel = document.createElement('div') // create label div
    toggleLabel.style.maxHeight = '44px' // prevent flex overgrowth
    toggleLabel.style.margin = '2px 0' // add v-margins
    toggleLabel.style.userSelect = 'none' // prevent highlighting
    for (const navLink of document.querySelectorAll('nav[aria-label="Chat history"] a')) { // inspect sidebar for classes to borrow
        if (/(new|clear) chat/i.test(navLink.text)) { // focus on new/clear chat button
            toggleLabel.setAttribute('class', navLink.classList) // borrow link classes
            navLink.parentNode.style.margin = '2px 0' // add v-margins
            break // stop looping since class assignment is done
    }}
    toggleLabel.addEventListener('click', () => {
        const toggleInput = document.querySelector('#infToggleInput')
        toggleInput.checked = !toggleInput.checked
        setTimeout(updateToggleHTML, 200) // sync label change w/ switch movement
        settings.save('infinityMode', toggleInput.checked)
        infinityMode.toggle()
    })
    updateToggleHTML()

    // Insert full toggle on page load
    await chatgpt.isLoaded()
    settings.load(['extensionDisabled']).then(() => {
        if (!config.extensionDisabled) insertToggle() })

    // Monitor node changes to update toggle visibility
    const nodeObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length) {
                settings.load(['extensionDisabled']).then(() => {
                    if (!config.extensionDisabled) insertToggle()
    })}})}) ; nodeObserver.observe(document.documentElement, { childList: true, subtree: true })

    // Define FEEDBACK functions

    function notify(msg, position = '', notifDuration = '', shadow = '') {
        chatgpt.notify(`${ config.appSymbol } ${ msg }`, position, notifDuration,
            shadow || chatgpt.isDarkMode() ? '' : 'shadow' )
    }

    alertToUpdate = (version) => { // eslint-disable-line no-undef
        if (version) {
            alert(`${ chrome.i18n.getMessage('alert_updateAvail') }!`,
                chrome.i18n.getMessage('alert_newerVer') + ' ' + chrome.i18n.getMessage('appName')
                    + ' v' + version.toString() + ' ' + chrome.i18n.getMessage('alert_isAvail') + '!   '
                    + '<a target="_blank" rel="noopener" style="font-size: 0.7rem" '
                        + 'href="' + config.gitHubURL + '/commits/main/chrome/extension" '
                        + '>' + chrome.i18n.getMessage('link_viewChanges') + '</a>',
                function reloadChrome() { chrome.runtime.reload() } // update button
            )
        } else {
            alert(chrome.i18n.getMessage('alert_upToDate') + '!',
                chrome.i18n.getMessage('appName') + ' v' + chrome.runtime.getManifest().version
                    + ' ' + chrome.i18n.getMessage('alert_isUpToDate') + '!')
    }}

    // Define TOGGLE functions

    function insertToggle() {
        const chatHistoryNav = document.querySelector('nav[aria-label="Chat history"]') || {},
              firstButton = chatHistoryNav.querySelector('a') || {}
        if (chatgpt.history.isOff()) // hide enable-history spam div
            try { firstButton.parentNode.nextElementSibling.style.display = 'none' } catch (error) {}
        if (!chatHistoryNav.contains(toggleLabel)) // insert toggle
            try { chatHistoryNav.insertBefore(toggleLabel, firstButton.parentNode) } catch (error) {}
    }

    function updateToggleHTML() {

        // Hide toggle if set to hidden or extension disabled
        settings.load(['toggleHidden', 'extensionDisabled']).then(() => {
            if (config.toggleHidden || config.extensionDisabled) toggleLabel.style.display = 'none'
            else {

                // Clear old content
                while (toggleLabel.firstChild) toggleLabel.firstChild.remove()

                // Create elements
                const navicon = document.createElement('img'),
                      label = document.createElement('label'),
                      labelText = document.createTextNode(chrome.i18n.getMessage('menuLabel_infinityMode') + ' '
                          + chrome.i18n.getMessage('state_' + ( config.infinityMode ? 'enabled' : 'disabled' ))),
                      input = document.createElement('input'),
                      span = document.createElement('span')
                navicon.src = config.assetHostURL + 'media/images/icons/infinity-symbol/white/icon64.png' ; navicon.width = 18
                label.id = 'infToggleLabel' ; label.className = 'switch'
                input.id = 'infToggleInput' ; input.type = 'checkbox' ; input.checked = config.infinityMode ; input.disabled = true
                span.className = 'slider'

                // Append elements
                label.appendChild(input) ; label.appendChild(span)
                toggleLabel.appendChild(navicon) ; toggleLabel.appendChild(label) ; toggleLabel.appendChild(labelText)

                // Show toggle
                toggleLabel.style.display = 'flex'
    }})}

    const infinityMode = {

        activate: async () => {
            if (!fromMsg) notify(chrome.i18n.getMessage('menuLabel_infinityMode') + ': ON')
            fromMsg = false
            try { chatgpt.startNewChat() } catch (error) { return }
            settings.load('replyLanguage', 'replyTopic', 'replyInterval').then(() => setTimeout(() => {
                chatgpt.send('Generate a single random question'
                    + ( config.replyLanguage ? ( ' in ' + config.replyLanguage ) : '' )
                    + ( ' on ' + ( config.replyTopic === 'ALL' ? 'ALL topics' : 'the topic of ' + config.replyTopic ))
                    + ' then answer it. Don\'t type anything else.')
            }, 500))
            await chatgpt.isIdle()
            if (config.infinityMode && !infinityMode.isActive) // double-check in case de-activated before scheduled
                infinityMode.isActive = setTimeout(infinityMode.continue, parseInt(config.replyInterval) * 1000)
        },

        continue: async () => {
            chatgpt.send('Do it again.')
            if (!config.autoScrollDisabled) try { chatgpt.scrollToBottom() } catch(error) {}
            await chatgpt.isIdle() // before starting delay till next iteration
            if (infinityMode.isActive) // replace timer
                infinityMode.isActive = setTimeout(infinityMode.continue, parseInt(config.replyInterval) * 1000)
        },

        deactivate: () => {
            if (!fromMsg) notify(chrome.i18n.getMessage('menuLabel_infinityMode') + ': OFF')
            fromMsg = false
            chatgpt.stop() ; clearTimeout(infinityMode.isActive) ; infinityMode.isActive = null
            document.querySelector('#infToggleInput').checked = false // for window listener
            settings.save('infinityMode', false) // in case toggled by PV listener
        },

        toggle: () => { config.infinityMode ? infinityMode.activate() : infinityMode.deactivate() }
    }

    // Define LIVE RESTART functions

    restartInNewChat = () => { // eslint-disable-line no-undef
        chatgpt.stop() ; document.querySelector('#infToggleLabel').click() // toggle off
        setTimeout(() => { document.querySelector('#infToggleLabel').click() }, 750) // toggle on
    }

    resetInSameChat = async () => { // eslint-disable-line no-undef
        clearTimeout(infinityMode.isActive) ; infinityMode.isActive = null ; await chatgpt.isIdle()
        if (config.infinityMode && !infinityMode.isActive) { // double-check in case de-activated before scheduled
            settings.load('replyInterval').then(() => {
                infinityMode.isActive = setTimeout(infinityMode.continue, parseInt(config.replyInterval) * 1000)
    })}}

    // Define SYNC function

    syncExtension = () => { // settings + sidebar toggle visibility
        settings.load(['extensionDisabled', 'toggleHidden', 'autoScrollDisabled',
                       'replyTopic', 'replyInterval', 'replyLanguage'])
            .then(() => { updateToggleHTML() // hide/show sidebar toggle based on latest setting
    })}

})()
