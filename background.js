const EMPTY_GROUP = chrome.tabGroups.TAB_GROUP_ID_NONE;

const getKey = async (key, defaultVal) => {
    const response = await new Promise((resolve, reject) => {
        chrome.storage.local.get({ [key]:defaultVal }, (result) => {
            resolve(result[key]);
        });
    });
    return response;
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

chrome.tabs.onActivated.addListener(async (info) => {
    await sleep(300);

    const tabId = info.tabId;
    const windowId = info.windowId;
    const lastGroup = await getKey(lastGroupKey(windowId), EMPTY_GROUP);
    
    const tabDetails = await chrome.tabs.get(tabId);
    const currentGroup = tabDetails.groupId;

    let enoughTime = true;
    const lastTime = await getKey('lastTime', 0);
    if(Date.now() - lastTime < 500) {
        enoughTime = false;
    }
    if(currentGroup !== lastGroup && lastGroup != EMPTY_GROUP && enoughTime) {
            chrome.tabGroups.update(lastGroup, {collapsed: true});
    }
    
    chrome.storage.local.set({ [lastGroupKey(windowId)]: currentGroup});
});

const lastGroupKey = (windowId) => 'lastGroup_' + windowId.toString();

const groupChange = (group) => {
    chrome.storage.local.set({ [lastGroupKey(group.windowId)]: group.id, lastTime: Date.now()});
};

chrome.tabGroups.onCreated.addListener(groupChange);
chrome.tabGroups.onUpdated.addListener(groupChange);
