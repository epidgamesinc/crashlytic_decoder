// 메모리 저장소
const memoryStore = {
    mappingData: null,
    fileLoadSuccess: false,
    fileName: '',
    isDebugMode : false,
};

// 메시지 핸들러
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
        case 'SET_DATA':
            memoryStore.mappingData = request.mappingData;
            memoryStore.fileLoadSuccess = request.fileLoadSuccess;
            memoryStore.fileName = request.fileName;
            memoryStore.isDebugMode = request.isDebugMode;
            sendResponse({ success: true });
            break;

        case 'GET_DATA':
            sendResponse({
                mappingData: memoryStore.mappingData,
                fileLoadSuccess: memoryStore.fileLoadSuccess,
                fileName: memoryStore.fileName,
                isDebugMode: memoryStore.isDebugMode,
            });
            break;

        default:
            sendResponse({ error: 'Invalid action' });
    }

    return true; // 비동기 응답 지시
});