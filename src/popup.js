'use strict';

import './popup.css';

const pako = require('pako');
// chrome.storage.local.get을 Promise로 래핑
function getStorageData(key) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(key, (result) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve(result[key]);
      }
    });
  });
}


function setStorageDataKeyValue(key, value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set({ [key]: value }, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);  // 실패 시 Error 객체 reject
      } else {
        resolve(true);  // 성공 시 true resolve
      }
    });
  });
}

function setStorageData(json) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(json, () => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError); // 에러 발생 시 reject
      } else {
        resolve('success'); // 성공 시 resolve
      }
    });
  });
}
// await 사용 예시
// popup.js
document.addEventListener('DOMContentLoaded', async () => {
  const dropZone = document.getElementById('drop-zone');
  const fileUpload = document.getElementById('file-upload');
  const fileInfo = document.getElementById('file-info');
  const clearBtn = document.getElementById('clear-btn');
  const refreshBtn = document.getElementById('refresh-btn');

  const activeAppCheckbox = document.getElementById('activeApp');

  activeAppCheckbox.addEventListener('change', async function() {
    // 체크박스의 상태가 변경될 때 실행되는 코드
    if (activeAppCheckbox.checked) {
      console.log('활성화됨');
      await setStorageDataKeyValue("isActive", true);
      sendRefreshMessage();
    } else {
      console.log('비활성화됨');
      setStorageDataKeyValue("isActive", false);
    }
  });

  fileUpload.addEventListener('change', handleFileSelect);

  setupDragAndDrop();

  clearBtn.addEventListener('click', clearFile);
  refreshBtn.addEventListener('click', sendRefreshMessage);

  await init();

  async function init() {
    showLoading(); // 로딩 시작

    await setActiveToggleStatus();
    clearBtn.style.display = 'none';
    let data = await fetchMappingData();
    displayFile(data);

    hideLoading();

    showHUD(); // HUD 표시 추가

  }

  async function setActiveToggleStatus(){
    let res = await getStorageData("isActive");
    if(res == null){
      activeAppCheckbox.checked = true;
      setStorageDataKeyValue("isActive", true);
      return true;
    }

    activeAppCheckbox.checked = res;

    return res;
  }

  function sendRefreshMessage(){
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs){
      chrome.tabs.sendMessage(tabs[0].id, {action: "refreshPage"}, function(response) {});
    });
  }
  async function fetchMappingData() {
    try {
      const aosMappingData = await getStorageData('aos');
      const iosMappingData = await getStorageData('ios');

      if (
        aosMappingData != null &&
        aosMappingData.mappingData != null &&
        aosMappingData.version != null
      ) {
        aosMappingData.mappingData = partialDecode(aosMappingData.mappingData);
      }

      if (
        iosMappingData != null &&
        iosMappingData.mappingData != null &&
        iosMappingData.version != null
      ) {
        iosMappingData.mappingData = partialDecode(iosMappingData.mappingData);
      }

      return {
        aos: aosMappingData,
        ios: iosMappingData,
      };
    } catch (error) {
      console.error('Error fetching mappingData:', error);
      return null;
    }
  }


  function showHUD() {
    const hudContainer = document.createElement('div');
    hudContainer.id = 'hud-container';
    hudContainer.style.padding = '10px';
    hudContainer.style.marginBottom = '15px';
    hudContainer.style.borderRadius = '4px';
    hudContainer.style.textAlign = 'center';
    hudContainer.style.fontWeight = 'bold';


    // 기존 HUD 제거
    const existingHud = document.getElementById('hud-container');
    if (existingHud) {
      existingHud.remove();
    }

    // 컨테이너 최상단에 추가
    const container = document.querySelector('.container');
    container.insertBefore(hudContainer, container.firstChild);
  }

  function setupDragAndDrop() {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, unhighlight, false);
    });

    dropZone.addEventListener('drop', handleDrop, false);
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight() {
    dropZone.classList.add('highlight');
  }

  function unhighlight() {
    dropZone.classList.remove('highlight');
  }

  function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    handleFiles(files);
  }

  function handleFileSelect(e) {
    const files = e.target.files;
    handleFiles(files);
  }

  async function handleFiles(files) {
    if (files.length > 0) {
        await readFile(files);
        init();
      sendRefreshMessage();
    }
  }
  async function readFile(files) {
    try {
      showLoading();

      let iosHighestVersion = -1;
      let aosHighestVersion = -1;

      // 모든 파일 처리 프로미스 생성
      const fileProcessingPromises = Array.from(files).map(file => {
        return new Promise((resolve, reject) => {
          if (file.type === 'text/plain' || file.name.endsWith('.txt')) {

            if(file.name.includes('NameTransition') === false || file.name.includes('Production') === false){
              resolve();
              return;
            }

            let fileInfo = parseFileName(file.name);
            if(fileInfo.store === 'iOS'){
              if(iosHighestVersion >= fileInfo.version){
                resolve();
                return;
              }
              iosHighestVersion = fileInfo.version;
            }
            else if(fileInfo.store === 'Android'){
              if(aosHighestVersion >= fileInfo.version){
                resolve();
                return;
              }
              aosHighestVersion = fileInfo.version;
            }

            const reader = new FileReader();

            reader.onload = async (e) => {
              try {
                const content = e.target.result;
                await processMappingData(fileInfo, content);
                resolve(); // 파일 처리 완료
              } catch (error) {
                reject(error);
              }
            };

            reader.onerror = () => {
              reject(new Error('파일을 읽는 중 오류가 발생했습니다.'));
            };

            reader.readAsText(file);
          } else {
            resolve(); // 텍스트 파일이 아니면 건너뜀
          }
        });
      });

      // 모든 파일 처리 완료 대기
      await Promise.all(fileProcessingPromises);

      hideLoading();
      showHUD(); // HUD 표시 추가
      //console.log("모든 파일 로드 완료");
    } catch (error) {
      hideLoading();
      displayError(error.message);
    }
  }

  // 로딩 표시 함수
  function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'flex';
  }

  // 로딩 숨기기 함수
  function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    overlay.style.display = 'none';
  }

  function displayFile(data) {
    // 기존 표시 영역 정리
    const container = document.getElementById('file-display-container') || createDisplayContainer();

    // 컨테이너 스타일 초기화
    container.innerHTML = '';
    container.style.display = 'block';

    const titleMsg = document.createElement('div');
    titleMsg.className = 'empty-message';
    titleMsg.textContent = '업로드된 NameTransition 텍스트 파일 상태';
    container.appendChild(titleMsg);

    const fileExist = data != null && (!!data['aos'] || !!data['ios']);
    clearBtn.style.display = fileExist ? 'block' : 'none';
    // AOS 데이터 표시
    createPlatformSection(container, 'aos', 'Android', data != null && data['aos'] ? data['aos'].version : null);
    createPlatformSection(container, 'ios', 'iOS',data != null && data['ios'] ? data['ios'].version : null);
  }

// 표시 컨테이너 생성 함수
  function createDisplayContainer() {
    const container = document.createElement('div');
    container.id = 'file-display-container';
    container.className = 'file-display-container';
    fileInfo.appendChild(container);
    return container;
  }

// 플랫폼별 섹션 생성 함수
  function createPlatformSection(container, platformId, title, version) {
    const section = document.createElement('div');
    section.className = `platform-section ${platformId}`;

    // 헤더 생성
    const header = document.createElement('div');
    header.className = 'platform-header';
    header.innerHTML = `<h2>${title}</h2>
  <span class="version ${!version ? 'missing' : ''}">
    ${version ? `v${version}` : '파일 없음'}
  </span>`;
    section.appendChild(header);

    container.appendChild(section);
  }

  function displayError(message) {
    // fileContent.textContent = message;
    fileInfo.style.display = 'block';
    // chrome.storage.local.remove(['savedFileName', 'savedFileContent']);
  }

  async function clearFile() {
    let json = {
      'aos':null,
      'ios':null
    };
    await setStorageData(json);

    displayFile(json);
    showHUD(); // HUD 표시 추가

    sendRefreshMessage();

  }

  function processMappingData(fileInfo, content) {
    try {
      JSON.parse(content);

      var encoded = partialEncode(content);

      if(fileInfo.store === 'Android'){
        setStorageData({aos:{
            version:fileInfo.version,
            mappingData:encoded
          }});
      }
      else {
        setStorageData({ios:{
            version:fileInfo.version,
            mappingData:encoded
          }});
      }
      chrome.storage.local.set({ mappingData: encoded });
    } catch (e) {
      console.error('매핑 데이터 파싱 실패:', e);
    }
  }

  function partialEncode(content) {
    var compressed = pako.gzip(content);
    var chunkSize = 1020; // 4의 배수
    var result = '';

    for (var i = 0; i < compressed.length; i += chunkSize) {
      var chunk = compressed.slice(i, i + chunkSize);
      var binaryString = Array.from(chunk).map(c => String.fromCharCode(c)).join('');
      result += btoa(binaryString);
    }

    return result;
  }

  function partialDecode(encodedString, originalChunkSize = 1020) {
    var uint8Arrays = [];
    var pos = 0;

    while (pos < encodedString.length) {
      // base64 문자열의 길이는 4의 배수여야 함
      var chunkLength = Math.min(originalChunkSize * 4 / 3, encodedString.length - pos);
      chunkLength = Math.floor(chunkLength / 4) * 4; // 4의 배수로 맞춤

      var chunkB64 = encodedString.substr(pos, chunkLength);
      pos += chunkLength;

      try {
        var binaryString = atob(chunkB64);
        var chunkArray = new Uint8Array(binaryString.length);
        for (var i = 0; i < binaryString.length; i++) {
          chunkArray[i] = binaryString.charCodeAt(i);
        }
        uint8Arrays.push(chunkArray);
      } catch (e) {
        console.error("청크 디코딩 실패:", e);
        return null;
      }
    }

    // 모든 청크 병합
    var totalLength = uint8Arrays.reduce((sum, arr) => sum + arr.length, 0);
    var merged = new Uint8Array(totalLength);
    var offset = 0;
    uint8Arrays.forEach(arr => {
      merged.set(arr, offset);
      offset += arr.length;
    });

    // 압축 해제
    try {
      var decompressed = pako.ungzip(merged, { to: 'string' });
      return JSON.parse(decompressed);
    } catch (e) {
      console.error("처리 실패:", e);
      return null;
    }
  }

  const parseFileName = (fileName) => {
    if (!fileName) return { store: '', version: '' };

    let store = fileName.includes('GooglePlayStore')
      ? 'Android'
      : fileName.includes('AppleAppStore')
        ? 'iOS'
        : '';

    let fileVersion = '';
    const versionMatch = fileName.match(/Ver (\d+\.\d+\.\d+)/);
    if (versionMatch) {
      const parts = versionMatch[1].split('.');
      fileVersion =
        parts.length === 3
          ? `${parts[0]}${parts[1].padStart(
            2,
            '0'
          )}${parts[2].padStart(2, '0')}`
          : '';
    }

    return { store, version: fileVersion };
  };

});
