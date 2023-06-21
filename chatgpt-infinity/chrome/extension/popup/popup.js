(async () => {

    // Import settings-utils.js
    const { config, settings } = await import(chrome.runtime.getURL('lib/settings-utils.js'))

    // Locate settings elements
    const mainToggle = document.querySelector('input')
    const menuItems = document.querySelectorAll('.menu-item')
    const infinityModeDiv = menuItems[0], infinityModeToggle = infinityModeDiv.querySelector('input')
    const toggleVisDiv = menuItems[1], toggleVisToggle = toggleVisDiv.querySelector('input')
    const autoScrollDiv = menuItems[2], autoScrollToggle = autoScrollDiv.querySelector('input')
    const replyLangDiv = menuItems[3], replyLangLabel = replyLangDiv.querySelector('span')
    const replyTopicDiv = menuItems[4], replyTopicLabel = replyTopicDiv.querySelector('span')
    const replyIntervalDiv = menuItems[5], replyIntervalLabel = replyIntervalDiv.querySelector('span')

    // Sync toggle states
    settings.load(['extensionDisabled', 'infinityMode', 'toggleHidden', 'autoScrollDisabled',
                   'replyInterval', 'replyTopic', 'replyLanguage', 'userLanguage'])
        .then(() => { // restore toggle states
            mainToggle.checked = !config.extensionDisabled
            infinityModeToggle.checked = config.infinityMode
            toggleVisToggle.checked = !config.toggleHidden
            autoScrollToggle.checked = !config.autoScrollDisabled
            replyLangLabel.innerText += ` — ${ config.replyLanguage }`
            replyTopicLabel.innerText += ' — '
                + ( config.replyTopic.toUpperCase() == 'ALL' ? config.replyTopic.toUpperCase()
                                                             : toTitleCase(config.replyTopic) )
            replyIntervalLabel.innerText += ` — ${ config.replyInterval }s`
            updateGreyness()
        })

    // Localize labels
    document.querySelectorAll('[data-locale]').forEach(elem => {
        elem.innerText = chrome.i18n.getMessage(elem.dataset.locale) })

    // Add main toggle click-listener
    mainToggle.addEventListener('change', () => {
        settings.save('extensionDisabled', !config.extensionDisabled)
        infinityModeToggle.checked = false // always disable Infinity Mode on main toggle
        syncExtension() ; updateGreyness()
    })

    // Add Infinity Mode click-listeners
    infinityModeToggle.addEventListener('change', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0].url.includes('chat.openai.com')) return // do nothing if not on ChatGPT
            else chrome.tabs.sendMessage(tabs[0].id, { action: 'clickToggle' }) // else click sidebar toggle
        })
        notify(chrome.i18n.getMessage('menuLabel_infinityMode') + ' ' + ( config.infinityMode ? 'ON' : 'OFF' ))
    })
    infinityModeDiv.addEventListener('click', (event) => {
        if ([infinityModeDiv, document.querySelector('[data-locale*="infinityMode"]')].includes(event.target))
            infinityModeToggle.click() 
    })

    // Add Toggle Visibility click-listeners
    toggleVisToggle.addEventListener('change', () => {
        settings.save('toggleHidden', !config.toggleHidden) ; syncExtension()
        notify(chrome.i18n.getMessage('menuLabel_toggleVis') + ' ' + ( !config.toggleHidden ? 'ON' : 'OFF' ))
    })
    toggleVisDiv.addEventListener('click', (event) => {
        if ([toggleVisDiv, document.querySelector('[data-locale*="toggleVis"]')].includes(event.target))
            toggleVisToggle.click() 
    })

    // Add Auto-Scroll click-listeners
    autoScrollToggle.addEventListener('change', () => {
        settings.save('autoScrollDisabled', !config.autoScrollDisabled) ; syncExtension()        
        notify(chrome.i18n.getMessage('menuLabel_autoScroll') + ' ' + ( !config.autoScrollDisabled ? 'ON' : 'OFF' ))
    })
    autoScrollDiv.addEventListener('click', (event) => {
        if ([autoScrollDiv, document.querySelector('[data-locale*="autoScroll"]')].includes(event.target))
            autoScrollToggle.click() 
    })

    // Add Reply Language click-listener
    replyLangDiv.addEventListener('click', () => {
        while (true) {
            const replyLanguage = prompt(`${ chrome.i18n.getMessage('prompt_updateReplyLang') }:`, config.replyLanguage)
            if (replyLanguage === null) break // user cancelled so do nothing
            else if (!/\d/.test(replyLanguage)) {
                settings.save('replyLanguage', replyLanguage ? replyLanguage : config.userLanguage)
                window.close() // popup
                alert(chrome.i18n.getMessage('alert_replyLangUpdated') + '!', chrome.i18n.getMessage('alert_willReplyIn') + ' '
                    + ( replyLanguage ? replyLanguage : chrome.i18n.getMessage('alert_yourSysLang') ) + '.')
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { // check active tab
                    if (tabs[0].url.includes('chat.openai.com') && config.infinityMode) { // reboot active session
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'restartOnReplyLang' }) }
                })
                break
    }}})

    // Add Reply Topic click-listener
    replyTopicDiv.addEventListener('click', () => {
        while (true) {
            const replyTopic = prompt('Update reply topic:', config.replyTopic)
            if (replyTopic === null) break // user cancelled so do nothing
            else if (!/\d/.test(replyTopic)) {
                settings.save('replyTopic', replyTopic ? replyTopic : 'ALL')
                window.close() // popup
                alert('Topic updated!', chrome.i18n.getMessage('appName') + ' will answer questions on '
                        + ( !replyTopic || replyTopic.toUpperCase() == 'ALL' ? 'ALL topics'
                                                                             : 'the topic of ' + replyTopic ) + '!')
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { // check active tab
                    if (tabs[0].url.includes('chat.openai.com') && config.infinityMode) { // reboot active session
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'restartOnReplyTopic' }) }
                })
                break
    }}})

    // Add Reply Interval click-listener
    replyIntervalDiv.addEventListener('click', () => {
        while (true) {
            const replyInterval = prompt(`${ chrome.i18n.getMessage('prompt_updateReplyInt') }:`, config.replyInterval)
            if (replyInterval === null) break // user cancelled so do nothing
            else if (!isNaN(parseInt(replyInterval)) && parseInt(replyInterval) > 4) { // valid int set
                settings.save('replyInterval', parseInt(replyInterval))
                window.close() // popup
                alert(chrome.i18n.getMessage('alert_replyIntUpdated') + '!', chrome.i18n.getMessage('alert_willReplyEvery')
                    + ' ' + replyInterval + ' ' + chrome.i18n.getMessage('unit_seconds') + '.')
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => { // check active tab
                    if (tabs[0].url.includes('chat.openai.com') && config.infinityMode) // reboot active session
                        chrome.tabs.sendMessage(tabs[0].id, { action: 'restartOnReplyInt' })
                })
                break
    }}})

    // Add update-check span click-listener
    const updateSpan = document.querySelector('span[title*="update" i]')
    updateSpan.addEventListener('click', () => {
        window.close() // popup
        chrome.runtime.requestUpdateCheck((status, version) => {
            if (status === 'update_available') {
                alert(`${ chrome.i18n.getMessage('alert_updateAvail') }!`,
                    chrome.i18n.getMessage('alert_newerVer') + ' ' + chrome.i18n.getMessage('appName')
                        + ' v' + version.toString() + ' ' + chrome.i18n.getMessage('alert_isAvail') + '!   '
                        + '<a target="_blank" href="https://github.com/adamlui/chatgpt-infinity/commits/main/chrome/extension" '
                        + 'style="font-size: 0.7rem">' + chrome.i18n.getMessage('link_viewChanges') + '</a>',
                    function update() { chrome.runtime.reload() } // update button
                )
            } else { // alert to no update found
                alert(chrome.i18n.getMessage('alert_upToDate') + '!',
                    chrome.i18n.getMessage('appName') + ' v' + chrome.runtime.getManifest().version
                        + ' ' + chrome.i18n.getMessage('alert_isUpToDate') + '!')
            }
    })})

    // Add Support span click-listener
    const supportLink = document.querySelector('a[title*="support" i]')
    const supportSpan = supportLink.parentNode 
    supportSpan.addEventListener('click', (event) => {
        if (event.target == supportSpan) supportLink.click() // to avoid double-toggle
    })

    // Add More Add-ons span click-listener
    const moreAddOnsLink = document.querySelector('a[title*="more" i]')
    const moreAddOnsSpan = moreAddOnsLink.parentNode 
    moreAddOnsSpan.addEventListener('click', (event) => {
        if (event.target == moreAddOnsSpan) moreAddOnsLink.click() // to avoid double-toggle
    })

    // Add Powered by chatgpt.js hover-listener
    const chatGPTjsHostPath = 'https://raw.githubusercontent.com/chatgptjs/chatgpt.js/main/media/images/badges/'
    const chatGPTjsImg = document.querySelector('.chatgpt-js img')
    chatGPTjsImg.addEventListener('mouseover', function() {
        chatGPTjsImg.src = chatGPTjsHostPath + 'powered-by-chatgpt.js.png' })
    chatGPTjsImg.addEventListener('mouseout', function() {
      chatGPTjsImg.src = chatGPTjsHostPath + 'powered-by-chatgpt.js-faded.png' })

    // Define FUNCTIONS

    function notify(msg, position) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'notify', msg: msg, position: position ? position : 'bottom-right' })
    })}

    function alert(title = '', msg = '', btns = '', checkbox = '', width = '') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { 
                action: 'alert', title: title, msg: msg, btns: btns, checkbox: checkbox, width: width
    })})}

    function toTitleCase(str) {
        const words = str.toLowerCase().split(' ')
        for (let i = 0 ; i < words.length ; i++)
            words[i] = words[i][0].toUpperCase() + words[i].slice(1)
        return words.join(' ')
    }

    function syncExtension() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.tabs.sendMessage(tabs[0].id, { action: 'syncExtension' })
    })}

    function updateGreyness() {

        // Updated toolbar icon
        const dimensions = [16, 32, 64, 128], iconPaths = {}
        dimensions.forEach((dimension) => {
            iconPaths[dimension] = '../icons/'
                + (config.extensionDisabled ? 'faded/' : '')
                + 'icon' + dimension + '.png'
        })
        chrome.action.setIcon({ path: iconPaths })

        // Update menu contents
        document.querySelectorAll('div.logo, div.menu-title, div.menu')
            .forEach((elem) => {
                elem.classList.remove(mainToggle.checked ? 'disabled' : 'enabled')
                elem.classList.add(mainToggle.checked ? 'enabled' : 'disabled')
            })
    }

})()
