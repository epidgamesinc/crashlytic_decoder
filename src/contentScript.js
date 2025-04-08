// DOM 변경 감지 옵저버

const pako = require('pako');

let lastUrl = null;

const observer = new MutationObserver(async () => {
  await processPage();
});

async function processPage() {
  if(window.location.href.includes("trickcal-revive/crashlytics/app") === false){
    return;
  }

  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    console.log('URL changed to:', lastUrl);
    await waitForAjaxComplete();

    console.log('ajax complete');
    let pageVersion = await getCurrentPageOSVersion();
    console.log('page version', pageVersion);

    let data = await fetchMappingData();

    displayStatus(pageVersion, data);

    console.log(data);
    await processNewElements(data);
  }
}

function displayStatus(pageVersion, data) {
  // 기존 상태바 제거
  const existingStatusBar = document.getElementById('floating-status-bar');
  if (existingStatusBar) existingStatusBar.remove();

  // 유효성 검사
  const isValid = !(
    pageVersion?.os == null ||
    data == null ||
    pageVersion?.version == null ||
    data[pageVersion.os]?.mappingData == null ||
    data[pageVersion.os]?.version !== pageVersion?.version
  );

  // 상태바 생성
  const statusBar = document.createElement('div');
  statusBar.id = 'floating-status-bar';

  // 기본 스타일 (파스텔 톤)
  statusBar.style.position = 'fixed';
  statusBar.style.top = '0';
  statusBar.style.left = '0';
  statusBar.style.width = '100%';
  statusBar.style.padding = '12px';
  statusBar.style.textAlign = 'center';
  statusBar.style.fontWeight = '500';
  statusBar.style.zIndex = '9999';
  statusBar.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
  statusBar.style.color = '#5a5a5a';
  statusBar.style.fontFamily = 'Arial, sans-serif';
  statusBar.style.fontSize = '14px';
  statusBar.style.backdropFilter = 'blur(4px)';
  statusBar.style.transition = 'all 0.4s ease-out';

  // 상태에 따른 스타일 설정 (파스텔 컬러)
  if (isValid) {
    statusBar.style.backgroundColor = 'rgba(173, 216, 230, 0.85)'; // 파스텔 블루
    statusBar.style.borderBottom = '1px solid rgba(100, 149, 237, 0.3)';
    statusBar.textContent = '🌸 현재 페이지';

    // OS별 추가 정보
    if (pageVersion.os === 'aos') {
      statusBar.textContent += ` - Android v${pageVersion.version}`;
    } else if (pageVersion.os === 'ios') {
      statusBar.textContent += ` - iOS v${pageVersion.version}`;
    }

    statusBar.textContent += ' / 업로드된 NameTransition - ';

    if (pageVersion.os === 'aos') {
      statusBar.textContent += `Android`;
    } else if (pageVersion.os === 'ios') {
      statusBar.textContent += `iOS`;
    }

    statusBar.textContent += ' v' +data[pageVersion.os].version;



  } else {
    statusBar.style.backgroundColor = 'rgba(255, 182, 193, 0.85)'; // 파스텔 핑크
    statusBar.style.borderBottom = '1px solid rgba(219, 112, 147, 0.3)';
    statusBar.textContent = '☁️ 데이터 불일치 또는 정보 누락';
  }

  // 닫기 버튼 추가 (눈에 편안한 디자인)
  const closeBtn = document.createElement('span');
  closeBtn.textContent = '✕';
  closeBtn.style.position = 'absolute';
  closeBtn.style.right = '15px';
  closeBtn.style.cursor = 'pointer';
  closeBtn.style.opacity = '0.6';
  closeBtn.style.transition = 'opacity 0.2s';
  closeBtn.onmouseover = () => closeBtn.style.opacity = '1';
  closeBtn.onmouseout = () => closeBtn.style.opacity = '0.6';
  closeBtn.onclick = () => statusBar.remove();

  statusBar.appendChild(closeBtn);
  document.body.prepend(statusBar);
}
// 사용 예시:
// displayStatus(
//   { os: 'aos', version: '1.2.3' },
//   {
//     aos: { version: '1.2.3', mappingData: {} },
//     ios: { version: '2.0.1', mappingData: {} }
//   }
// );

async function getCurrentPageOSVersion(){
  let os = null;
  let version = null;

  if (document.querySelectorAll('.caption-table-cell.ng-star-inserted').length > 0) {
    if(document.location.href.includes("trickcal-revive/crashlytics/app/ios:")){
      os = 'ios';
      version = document.querySelector('.version-title').innerHTML.match(/\d+/)[0];
    }
    else if(document.location.href.includes("trickcal-revive/crashlytics/app/android:")){
      os = 'aos';

      let nodes = [...document.querySelectorAll('.mat-mdc-tooltip-trigger.version-range')];
      version = Object.entries(
        nodes.map(t=>t.innerHTML).flatMap(s => s.split('–').map(n => n.trim()))
          .reduce((a, n) => (a[n] = (a[n]||0)+1, a), {})
      ).sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0].trim();


    }

    return {
      os : os,
      version : version
    }
  }


  if (document.querySelectorAll('.gmp-icons.platform-icon.ng-star-inserted').length > 0 && document.querySelectorAll('.gmp-icons.platform-icon.ng-star-inserted')[0].innerHTML.includes("ios")) {
    os = 'ios';
    var obj = document.querySelector('.session-build-version.header-item')?.querySelector('.header-item-text.ng-star-inserted')?.innerHTML;
    const match = obj?.match(/^\s*(\d+)\s*\(/);
    version = match ? match[1] : null;

    return {
      os : os,
      version : version
    }
  }

  if (document.querySelectorAll('.gmp-icons.platform-icon.ng-star-inserted').length > 0 && document.querySelectorAll('.gmp-icons.platform-icon.ng-star-inserted')[0].innerHTML.includes("android")) {
    os = 'aos';
    var obj = document.querySelector('.session-build-version.header-item')?.querySelector('.header-item-text.ng-star-inserted')?.innerHTML;
    const match = obj?.match(/^\s*(\d+)\s*\(/);
    version = match ? match[1] : null;

    return {
      os : os,
      version : version
    }
  }


}

async function processNewElements(mappingData) {
  if (document.querySelectorAll('.caption-table-cell.ng-star-inserted').length > 0) {
    console.log("summarize recognized");
    await processSummarizeElement(mappingData);
  }

  if (document.querySelectorAll('.gmp-icons.platform-icon.ng-star-inserted').length > 0 && document.querySelectorAll('.gmp-icons.platform-icon.ng-star-inserted')[0].innerHTML.includes("ios")) {
    console.log("ios recognized");

    await processIOSElement(mappingData);
  }

  if (document.querySelectorAll('.gmp-icons.platform-icon.ng-star-inserted').length > 0 && document.querySelectorAll('.gmp-icons.platform-icon.ng-star-inserted')[0].innerHTML.includes("android")) {
    console.log("android recognized");

    await processAOSElement(mappingData);
  }
}

async function processSummarizeElement(parsedMapping) {
  const cells = document.querySelectorAll('.caption-table-cell.ng-star-inserted');
  // 각 요소에 스타일 적용
  cells.forEach(cell => {
    const wrappers = cell.querySelector('[data-test-id="blamedFileWrapper"]');
    if (wrappers != null) {
      const target = wrappers.querySelector('.copy-target');

      var className = extractClassNameFromTitle(target.textContent);
      var methodName = extractMethodName(target.textContent, cell.querySelector('.title-wrapper > .copy-target').textContent);

      var translated = '';
      methodName.split('.').forEach((methodName) => {
        translated += getTranslated(methodName, className, parsedMapping);

      });

      addTranslatedMessage(cell.querySelector('.title-wrapper'), translated);

    }

  });
}

async function processAOSElement(parsedMapping) {
  const cells = document.querySelectorAll('.c9s-stack-frame');
  // 각 요소에 스타일 적용
  cells.forEach(cell => {
    const wrappers = cell.querySelector('.context-cell > div');
    if (wrappers != null) {
      const {
        className,
        methodName,
      } = parseAndroidStack(wrappers.textContent.trim());

      var translated = '';
      methodName.split('.').forEach((methodName) => {
        translated += getTranslated(methodName, className, parsedMapping);

      });

      addTranslatedMessage(wrappers, translated);

    }

  });
}

async function processIOSElement(parsedMapping) {
  const cells = document.querySelectorAll('.stack-frame.native-frame.developer-code.ng-star-inserted');
  // 각 요소에 스타일 적용
  cells.forEach(cell => {
    const symbolDiv = cell.querySelector('.frame-symbol');
    const fileLine = cell.querySelector('.frame-file-line span');

    let {
      className,
      methodName,
    } = parseiOSStack(fileLine?.textContent.trim(), symbolDiv?.textContent.trim());

    console.log(className, methodName);
    var translated = '';
    methodName.split('.').forEach((methodName) => {
      translated += getTranslated(methodName, className, parsedMapping);

      console.log(translated);
    });

    addTranslatedMessage(symbolDiv, translated);
  });
}

function waitForAjaxComplete() {
  console.log('wait for ajax');
  return new Promise((resolve) => {
    const interval = setInterval(() => {
      // 지정된 요소가 존재하는지 확인
      if (document.querySelectorAll('.caption-table-cell.ng-star-inserted').length > 0) {
        if(document.location.href.includes('crashlytics/app/ios:')){
          if(document.querySelectorAll('.version-title').length > 0){
            {
              clearInterval(interval);  // 요소가 나타났으면 interval 멈추기
              resolve();
            }
          }
        }
        else {
          clearInterval(interval);  // 요소가 나타났으면 interval 멈추기
          resolve();
        }


      }

      if (document.querySelectorAll('.library-cell.ng-star-inserted').length > 0) {
        clearInterval(interval);  // 요소가 나타났으면 interval 멈추기
        resolve();
      }

      if (document.querySelectorAll('.stack-frame.ng-star-inserted').length > 0) {
        clearInterval(interval);  // 요소가 나타났으면 interval 멈추기
        resolve();
      }
    }, 500);
  });
}

// 옵저버 설정
observer.observe(document, {
  subtree: true,
  childList: true,
  attributes: true,
});


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

// await 사용 예시
async function fetchMappingData() {
  try {
    const aosMappingData = await getStorageData('aos');
    const iosMappingData = await getStorageData('ios');

    if(aosMappingData != null && aosMappingData.mappingData != null && aosMappingData.version != null){
      aosMappingData.mappingData = partialDecode(aosMappingData.mappingData);
    }

    if(iosMappingData != null && iosMappingData.mappingData != null && iosMappingData.version != null){
      iosMappingData.mappingData = partialDecode(iosMappingData.mappingData);
    }

    return {
      aos : aosMappingData,
      ios : iosMappingData
    }

  } catch (error) {
    console.error('Error fetching mappingData:', error);
    return null;
  }
}


// 페이지 로드 시 초기 처리
window.addEventListener('load', async () => {
  await processPage();
  startObserving();
});

// // history API 변경 감지 (SPA 대응)
// window.addEventListener('popstate', () => {
//   // setTimeout(initElementProcessing, 300); // SPA 라우팅 후 DOM 업데이트 대기
// });
//
// // 요소 처리 함수

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
      console.error('청크 디코딩 실패:', e);
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
    console.error('처리 실패:', e);
    return null;
  }
}

function extractMethodName(fullClassName, methodName) {
  if (fullClassName.includes('+')) {
    return fullClassName.split('+')[1];
  }

  return extractAfterPlusOrDot(methodName);
}

function extractClassNameFromTitle(str) {
  if (str.includes('+')) {
    return str.split('+')[0];
  }

  return str;
}

function addTranslatedMessage(wrappers, msg) {

  // 기존 translated-message 제거
  const existingMessage = wrappers.querySelector('.translated-message');
  if (existingMessage) {
    existingMessage.remove();
  }

  // 새로운 translated-message 생성
  const translatedDiv = document.createElement('div');
  translatedDiv.className = 'translated-message';
  translatedDiv.innerHTML = '<strong>Translated => ' + msg + '</strong>';
  translatedDiv.style.marginTop = '5px';
  translatedDiv.style.fontWeight = 'bold';

  // title-wrapper 바로 다음에 삽입
  wrappers.insertAdjacentElement('afterend', translatedDiv);

}

function extractAfterPlusOrDot(str) {
  // '+'가 있으면 '+' 이후의 문자열을 반환
  if (str.includes('+')) {
    return str.split('+')[1];
  }
  // '+'가 없으면 마지막 '.' 이후의 문자열을 반환
  else {
    const lastDotIndex = str.lastIndexOf('.');
    return str.slice(lastDotIndex + 1);
  }
}

function parseAndroidStack(text) {
  const lastParenIndex = text.lastIndexOf('(');

  // 1. className 추출: 마지막 ( ~ ) 사이 내용에서 + 앞부분
  const className = extractClassName(text);

  // 2. methodName 추출
  let methodName = '';
  if (text.includes('+')) {
    // +가 있는 경우: + ~ ( 사이
    const plusIndex = text.indexOf('+');
    methodName = text.slice(plusIndex + 1, lastParenIndex).trim();
  } else {
    // +가 없는 경우: 마지막 . ~ ( 사이
    const lastDotIndex = text.lastIndexOf('.', lastParenIndex);
    methodName = text.slice(lastDotIndex + 1, lastParenIndex).trim();
  }

  return { methodName, className };
}

// className 추출 헬퍼 함수
function extractClassName(text) {
  const betweenParen = text
    .slice(text.lastIndexOf('(') + 1, text.lastIndexOf(')'))
    .trim();
  return betweenParen.split('+')[0]; // +가 없으면 전체 반환
}

function parseiOSStack(title, subtitle) {
  let className = title.trim();
  let methodName = subtitle.trim();

  if (className.includes('+')) {
    methodName += '.' + className.split('+')[1].trim();
    className = className.split('+')[0].trim();
  }

  return {
    methodName: methodName,
    className: className,
  };
}

// 옵저버 시작
function startObserving() {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}


function getTranslated(methodName, className, parsedMapping) {
  var exist = false;
  var translatedText = '';

  for (const [key, value] of Object.entries(
    parsedMapping.MemberTyp_Mapping.Method.Mapping,
  )) {
    if (value === methodName && key.includes(className)) {
      translatedText += key + '\n';
      exist = true;
      break;
    }
  }

  if (exist == false) {
    for (const [key, value] of Object.entries(
      parsedMapping.MemberTyp_Mapping.Event.Mapping,
    )) {
      if (value === methodName && key.includes(className)) {
        translatedText += key + '\n';
        exist = true;
        break;
      }
    }
  }

  if (exist == false) {
    for (const [key, value] of Object.entries(
      parsedMapping.MemberTyp_Mapping.Type.Mapping,
    )) {
      if (value === methodName && key.includes(className)) {
        translatedText += key + '\n';
        exist = true;
        break;
      }
    }
  }

  if (exist == false) {
    for (const [key, value] of Object.entries(
      parsedMapping.MemberTyp_Mapping.Field.Mapping,
    )) {
      if (value === methodName && key.includes(className)) {
        translatedText += key + '\n';
        exist = true;
        break;
      }
    }
  }

  if (exist == false) {
    for (const [key, value] of Object.entries(
      parsedMapping.MemberTyp_Mapping.Property.Mapping,
    )) {
      if (value === methodName && key.includes(className)) {
        translatedText += key + '\n';
        exist = true;
        break;
      }
    }
  }

  if (translatedText == '') {
    for (const [key, value] of Object.entries(
      parsedMapping.MemberTyp_Mapping.Method.Mapping,
    )) {
      if (value === methodName) {
        translatedText += key + '\n';
      }
    }

    for (const [key, value] of Object.entries(
      parsedMapping.MemberTyp_Mapping.Event.Mapping,
    )) {
      if (value === methodName) {
        translatedText += key + '\n';
      }
    }

    for (const [key, value] of Object.entries(
      parsedMapping.MemberTyp_Mapping.Type.Mapping,
    )) {
      if (value === methodName) {
        translatedText += key + '\n';
      }
    }
    for (const [key, value] of Object.entries(
      parsedMapping.MemberTyp_Mapping.Field.Mapping,
    )) {
      if (value === methodName) {
        translatedText += key + '\n';
      }
    }

    for (const [key, value] of Object.entries(
      parsedMapping.MemberTyp_Mapping.Property.Mapping,
    )) {
      if (value === methodName) {
        translatedText += key + '\n';
      }
    }
    if (translatedText == '') {
      translatedText = '';
    }
    return translatedText;
  }
  return translatedText;
}
