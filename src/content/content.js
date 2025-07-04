// LibeCity to Notion - Content Script
// libecity.com専用のコンテンツ抽出機能

console.log('LibeCity to Notion Content Script loaded');

// libecity.com専用のセレクタ定義
const SELECTORS = {
  // 投稿関連
  postContainer: '.log_detail',
  postText: '.post_text',
  postTime: '.post_time, .time',
  postAuthor: '.user_name, .author',
  postAvatar: '.user_proficon img, .avatar img',
  
  // 画像関連（libecity.com固有のセレクタを追加）
  postImages: 'img.fr-fic.fr-dib.popup, .post_image img, .attachment img, img[src*="libecity"], img[src*="firebasestorage"], .fr-img, .fr-fic.fr-dib, img.popup',
  
  // リンク関連
  postLinks: '.post_text a, .link_preview',
  
  // メンション関連
  mentions: '.mention, [data-user-id]',
  
  // その他
  reactions: '.reaction, .like_count',
  replies: '.reply, .comment'
};

// セレクタの有効性をチェックする関数
function isValidSelector(selector) {
  try {
    document.querySelector(selector);
    return true;
  } catch (error) {
    console.error(`Invalid selector: ${selector}`, error);
    return false;
  }
}

// セレクタの検証
function validateSelectors() {
  console.log('Validating selectors...');
  Object.entries(SELECTORS).forEach(([key, selector]) => {
    if (!isValidSelector(selector)) {
      console.warn(`Invalid selector for ${key}: ${selector}`);
    }
  });
}

// 状態管理
let isSelectionMode = false;
let selectedElement = null;
let highlightOverlay = null;

// 初期化
function initialize() {
  console.log('Initializing LibeCity content script...');
  
  // ページの読み込み完了を待つ
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupContentScript);
  } else {
    setupContentScript();
  }
}

// コンテンツスクリプトのセットアップ
function setupContentScript() {
  console.log('Setting up content script for libecity.com');
  
  // セレクタの検証
  validateSelectors();
  
  // DOM変更の監視を開始
  setupDOMObserver();
  
  // メッセージリスナーの設定
  setupMessageListeners();
  
  // ページ情報の初期取得
  detectPageType();
  
  // チャット投稿の監視と保存アイコンの追加
  setupChatPostMonitoring();
}

// DOM変更の監視
function setupDOMObserver() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        // 新しい投稿が追加された場合の処理
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            try {
              const posts = node.querySelectorAll(SELECTORS.postContainer);
              if (posts.length > 0) {
                console.log(`New posts detected: ${posts.length}`);
              }
            } catch (error) {
              console.error('Failed to query posts in new nodes:', error);
            }
          }
        });
      }
    });
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// メッセージリスナーの設定
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Content script received message:', request);
    
    switch (request.action) {
      case 'extractContent':
        handleExtractContent(request, sendResponse);
        return true; // 非同期レスポンス
        
      case 'startSelection':
        startSelectionMode();
        sendResponse({ success: true });
        break;
        
      case 'stopSelection':
        stopSelectionMode();
        sendResponse({ success: true });
        break;
        
      case 'getPageInfo':
        sendResponse(getPageInfo());
        break;
        
      case 'ping':
        sendResponse({ status: 'active' });
        break;
        
      default:
        console.warn('Unknown action:', request.action);
        sendResponse({ error: 'Unknown action' });
    }
  });
}

// コンテンツ抽出のメイン処理
async function handleExtractContent(request, sendResponse) {
  try {
    let content;
    
    if (request.elementSelector) {
      // 特定の要素を指定された場合
      content = await extractSpecificContent(request.elementSelector);
    } else if (selectedElement) {
      // 選択された要素がある場合
      content = await extractElementContent(selectedElement);
    } else {
      // ページ全体から自動抽出
      content = await extractPageContent();
    }
    
    sendResponse({ success: true, content });
  } catch (error) {
    console.error('Content extraction failed:', error);
    sendResponse({ success: false, error: error.message });
  }
}

// 特定要素のコンテンツ抽出
async function extractSpecificContent(selector) {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  
  return await extractElementContent(element);
}

// 削除：重複した関数定義を削除

// ページ全体からのコンテンツ自動抽出
async function extractPageContent() {
  try {
    // libecity.com用の複数のセレクタを試行
    const possibleSelectors = [
      '.log_detail',
      '.post_text',
      '.message',
      '.chat_message',
      '.content',
      '[data-message]',
      'article',
      '.post'
    ];
    
    let posts = [];
    for (const selector of possibleSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          posts = Array.from(elements);
          console.log(`Found ${posts.length} posts with selector: ${selector}`);
          break;
        }
      } catch (error) {
        console.warn(`Selector failed: ${selector}`, error);
      }
    }
    
    if (posts.length === 0) {
      // フォールバック：ページ全体のテキストを抽出
      console.log('No specific posts found, extracting page content');
      return {
        type: 'page',
        timestamp: new Date().toISOString(),
        url: window.location.href,
        title: document.title,
        content: {
          text: document.body.innerText || document.body.textContent || 'コンテンツが見つかりません',
          html: document.body.innerHTML
        },
        metadata: {
          domain: window.location.hostname,
          pathname: window.location.pathname
        }
      };
    }
    
    // 最新の投稿を抽出（通常は最初の要素）
    const latestPost = posts[0];
    return await extractElementContent(latestPost);
  } catch (error) {
    console.error('Failed to extract page content:', error);
    throw new Error('ページからコンテンツを抽出できませんでした: ' + error.message);
  }
}

// 選択モードの開始
function startSelectionMode() {
  if (isSelectionMode) return;
  
  isSelectionMode = true;
  document.body.style.cursor = 'crosshair';
  
  // オーバーレイの作成
  createHighlightOverlay();
  
  // イベントリスナーの追加
  document.addEventListener('mouseover', handleMouseOver);
  document.addEventListener('mouseout', handleMouseOut);
  document.addEventListener('click', handleElementClick);
  
  console.log('Selection mode started');
}

// 選択モードの終了
function stopSelectionMode() {
  if (!isSelectionMode) return;
  
  isSelectionMode = false;
  document.body.style.cursor = '';
  
  // オーバーレイの削除
  if (highlightOverlay) {
    highlightOverlay.remove();
    highlightOverlay = null;
  }
  
  // イベントリスナーの削除
  document.removeEventListener('mouseover', handleMouseOver);
  document.removeEventListener('mouseout', handleMouseOut);
  document.removeEventListener('click', handleElementClick);
  
  console.log('Selection mode stopped');
}

// ハイライトオーバーレイの作成
function createHighlightOverlay() {
  highlightOverlay = document.createElement('div');
  highlightOverlay.style.cssText = `
    position: absolute;
    pointer-events: none;
    border: 2px solid #007bff;
    background-color: rgba(0, 123, 255, 0.1);
    z-index: 10000;
    display: none;
  `;
  document.body.appendChild(highlightOverlay);
}

// マウスオーバー処理
function handleMouseOver(event) {
  if (!isSelectionMode) return;
  
  const target = event.target;
  const rect = target.getBoundingClientRect();
  
  highlightOverlay.style.display = 'block';
  highlightOverlay.style.left = rect.left + window.scrollX + 'px';
  highlightOverlay.style.top = rect.top + window.scrollY + 'px';
  highlightOverlay.style.width = rect.width + 'px';
  highlightOverlay.style.height = rect.height + 'px';
}

// マウスアウト処理
function handleMouseOut(event) {
  if (!isSelectionMode) return;
  highlightOverlay.style.display = 'none';
}

// 要素クリック処理
function handleElementClick(event) {
  if (!isSelectionMode) return;
  
  event.preventDefault();
  event.stopPropagation();
  
  selectedElement = event.target;
  stopSelectionMode();
  
  // 選択完了をポップアップに通知
  try {
    chrome.runtime.sendMessage({
      action: 'elementSelected',
      element: {
        tagName: selectedElement.tagName,
        className: selectedElement.className,
        textContent: selectedElement.textContent.substring(0, 100) + '...',
        selector: generateSelector(selectedElement)
      }
    });
  } catch (error) {
    console.error('Failed to send element selection message:', error);
  }
  
  console.log('Element selected:', selectedElement);
}

// ページ情報の取得
function getPageInfo() {
  let postCount = 0;
  let hasContent = false;
  
  try {
    postCount = document.querySelectorAll(SELECTORS.postContainer).length;
  } catch (error) {
    console.error('Failed to count posts:', error);
  }
  
  try {
    hasContent = document.querySelectorAll(SELECTORS.postText).length > 0;
  } catch (error) {
    console.error('Failed to check content:', error);
  }
  
  return {
    url: window.location.href,
    title: document.title,
    domain: window.location.hostname,
    pathname: window.location.pathname,
    isLibeCity: window.location.hostname.includes('libecity.com'),
    postCount: postCount,
    hasContent: hasContent
  };
}

// ページタイプの検出
function detectPageType() {
  const pathname = window.location.pathname;
  const pageInfo = getPageInfo();
  
  console.log('Page info:', pageInfo);
  
  // ページタイプに応じた初期化
  if (pageInfo.isLibeCity) {
    console.log('LibeCity page detected');
    // LibeCity固有の初期化処理
  }
}

// 時間情報の抽出
function extractTime(timeElement) {
  const timeText = timeElement.textContent || timeElement.innerText;
  const timeAttr = timeElement.getAttribute('datetime') || 
                   timeElement.getAttribute('data-time') ||
                   timeElement.getAttribute('title');
  
  return {
    text: cleanText(timeText),
    datetime: timeAttr,
    timestamp: timeAttr ? new Date(timeAttr).toISOString() : new Date().toISOString()
  };
}

// HTML構造を解析してコンテンツの順序を抽出
function extractStructuredContent(element) {
  console.log('Starting structured content extraction...');
  const structuredContent = [];
  
  // 現在の文字修飾スタックを管理
  const formatStack = [];
  
  const walkNodes = (node, currentFormats = {}) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent;
      if (text) {
        // テキストを改行で分割し、空白行も含めて忠実に反映
        const lines = text.split(/\n/);
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trimmedLine = line.trim();
          
          if (trimmedLine) {
            // 内容のある行の場合
            // テキスト内のURLを検出してリンク化
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            const urlMatches = trimmedLine.match(urlRegex);
            
            if (urlMatches) {
              // URLを含むテキストの場合、テキストとリンクを分離
              let lastIndex = 0;
              urlMatches.forEach(url => {
                const urlIndex = trimmedLine.indexOf(url, lastIndex);
                
                // URL前のテキスト
                if (urlIndex > lastIndex) {
                  const beforeText = trimmedLine.substring(lastIndex, urlIndex).trim();
                  if (beforeText) {
                    structuredContent.push({
                      type: 'rich_text',
                      content: beforeText,
                      annotations: { ...currentFormats }
                    });
                  }
                }
                
                // URLをリンクとして追加
                structuredContent.push({
                  type: 'rich_text',
                  content: url,
                  annotations: { 
                    ...currentFormats,
                    underline: true,
                    color: 'blue'
                  },
                  link: { url: url }
                });
                
                lastIndex = urlIndex + url.length;
              });
              
              // URL後のテキスト
              if (lastIndex < trimmedLine.length) {
                const afterText = trimmedLine.substring(lastIndex).trim();
                if (afterText) {
                  structuredContent.push({
                    type: 'rich_text',
                    content: afterText,
                    annotations: { ...currentFormats }
                  });
                }
              }
            } else {
              // 通常のテキスト
              structuredContent.push({
                type: 'rich_text',
                content: trimmedLine,
                annotations: { ...currentFormats }
              });
            }
          } else if (!trimmedLine) {
            // 空白行の場合（空白文字のみの行も空白行として扱う）
            structuredContent.push({
              type: 'empty_line'
            });
            console.log(`Added empty line at position ${i}`);
          }
          
          // 行の終わりに改行を追加（最後の行以外）
          if (i < lines.length - 1) {
            structuredContent.push({
              type: 'linebreak'
            });
          }
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();
      
      // 除外すべき要素をスキップ
      if (node.classList.contains('action_area') || 
          node.classList.contains('reactionbox') || 
          node.classList.contains('editbox') ||
          node.classList.contains('notion-save-icon')) {
        return;
      }
      
      // 文字修飾タグの処理
      let newFormats = { ...currentFormats };
      
      switch (tagName) {
        case 'strong':
        case 'b':
          newFormats.bold = true;
          break;
        case 'em':
        case 'i':
          newFormats.italic = true;
          break;
        case 'u':
          newFormats.underline = true;
          break;
        case 's':
        case 'strike':
        case 'del':
          newFormats.strikethrough = true;
          break;
        case 'code':
          newFormats.code = true;
          break;
        case 'mark':
          newFormats.color = 'yellow_background';
          break;
      }
      
      if (tagName === 'img') {
        // 画像要素を処理
        const src = node.src;
        if (src) {
          const validatedUrl = isValidImageUrl(src);
          if (validatedUrl) {
            console.log(`Found image in structured content: ${src.substring(0, 50)}...`);
            structuredContent.push({
              type: 'image',
              src: typeof validatedUrl === 'string' ? validatedUrl : src,
              alt: node.alt && node.alt.trim() ? node.alt.trim() : '',
              title: node.title && node.title.trim() ? node.title.trim() : '',
              width: node.naturalWidth || node.width || 0,
              height: node.naturalHeight || node.height || 0
            });
          } else {
            console.warn('Invalid image URL skipped in structured content:', src);
          }
        }
      } else if (tagName === 'br') {
        // 改行要素を明示的に処理
        structuredContent.push({
          type: 'linebreak'
        });
      } else if (tagName === 'p' || tagName === 'div') {
        // ブロック要素の場合、子ノードを処理してから改行を追加
        const hasContent = structuredContent.length > 0;
        Array.from(node.childNodes).forEach(child => walkNodes(child, newFormats));
        
        // ブロック要素の後に改行を追加（内容がある場合のみ）
        if (hasContent && structuredContent.length > 0) {
          const lastItem = structuredContent[structuredContent.length - 1];
          if (lastItem.type !== 'linebreak') {
            structuredContent.push({
              type: 'linebreak'
            });
          }
        }
      } else if (tagName === 'a' && node.href) {
        // リンク要素を処理
        const linkText = node.textContent.trim();
        const linkUrl = node.href;
        
        if (linkUrl && !linkUrl.startsWith('javascript:') && !linkUrl.startsWith('#')) {
          // リンク内に画像がある場合
          const linkImages = node.querySelectorAll('img');
          if (linkImages.length > 0) {
            linkImages.forEach(img => {
              if (img.src) {
                const validatedUrl = isValidImageUrl(img.src);
                if (validatedUrl) {
                  console.log(`Found linked image in structured content: ${img.src.substring(0, 50)}...`);
                  structuredContent.push({
                    type: 'image',
                    src: typeof validatedUrl === 'string' ? validatedUrl : img.src,
                    alt: img.alt || linkText || '',
                    title: img.title || linkText || '',
                    isLinked: true,
                    linkUrl: linkUrl
                  });
                } else {
                  console.warn('Invalid linked image URL skipped:', img.src);
                }
              }
            });
          } else if (linkText) {
            // テキストリンクの場合
            structuredContent.push({
              type: 'rich_text',
              content: linkText,
              annotations: { 
                ...newFormats,
                underline: true,
                color: 'blue'
              },
              link: { url: linkUrl }
            });
          }
        }
      } else {
        // その他の要素は子ノードを再帰的に処理（文字修飾を継承）
        Array.from(node.childNodes).forEach(child => walkNodes(child, newFormats));
      }
    }
  };

  // libecity.com特有の構造に対応
  // .post_textクラスがある場合はそれを優先的に処理
  const postTextElement = element.querySelector('.post_text');
  if (postTextElement) {
    console.log('Found .post_text element, processing it specifically');
    
    // libecity.comの特殊な構造に対応：<p></p>や<p><br></p>を空白行として検出
    const paragraphs = postTextElement.querySelectorAll('p');
    paragraphs.forEach((p, index) => {
      const textContent = p.textContent.trim();
      const hasOnlyBr = p.innerHTML.trim() === '<br>' || p.innerHTML.trim() === '';
      
      // 画像が含まれているかチェック
      const hasImages = p.querySelectorAll('img').length > 0;
      
      // テキストも画像もない場合のみ空白行として処理
      if ((!textContent || hasOnlyBr) && !hasImages) {
        // 空白行として処理
        structuredContent.push({
          type: 'empty_line'
        });
        console.log(`Added empty line from <p> tag at index ${index}`);
      } else {
        // 通常の段落として処理（文字修飾と画像を含む）
        console.log(`Processing paragraph ${index} with content: text=${!!textContent}, images=${hasImages}`);
        Array.from(p.childNodes).forEach(child => walkNodes(child, {}));
      }
      
      // 各段落の後に改行を追加（最後の段落以外）
      if (index < paragraphs.length - 1) {
        structuredContent.push({
          type: 'linebreak'
        });
      }
    });
    
    // リンクプレビューも処理
    const linkPreviews = element.querySelectorAll('.link_preview');
    linkPreviews.forEach(preview => {
      const linkUrl = preview.href;
      const titleElement = preview.querySelector('.preview_title span');
      const linkText = titleElement ? titleElement.textContent.trim() : linkUrl;
      
      if (linkUrl) {
        structuredContent.push({
          type: 'rich_text',
          content: linkText,
          annotations: { 
            underline: true,
            color: 'blue'
          },
          link: { url: linkUrl }
        });
      }
    });
    
    // .tweetImageArea内の画像も処理（libecity.comの投稿画像）
    const tweetImageArea = element.querySelector('.tweetImageArea');
    if (tweetImageArea) {
      console.log('Found .tweetImageArea, processing tweet images');
      const tweetImages = tweetImageArea.querySelectorAll('.tweetImage img');
      console.log(`Found ${tweetImages.length} tweet images`);
      
      tweetImages.forEach((img, index) => {
        if (img.src) {
          const validatedUrl = isValidImageUrl(img.src);
          if (validatedUrl) {
            console.log(`Found tweet image ${index + 1}: ${img.src.substring(0, 50)}...`);
            structuredContent.push({
              type: 'image',
              src: typeof validatedUrl === 'string' ? validatedUrl : img.src,
              alt: img.alt && img.alt.trim() ? img.alt.trim() : '',
              title: img.title && img.title.trim() ? img.title.trim() : '',
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0
            });
          } else {
            console.warn('Invalid tweet image URL skipped:', img.src);
          }
        }
      });
    }
  } else {
    // 通常の要素処理
    Array.from(element.childNodes).forEach(child => walkNodes(child, {}));
  }

  // 連続する改行や空白行をクリーンアップ
  const cleanedContent = [];
  let lastType = null;
  
  structuredContent.forEach((item, index) => {
    // 連続する改行を防ぐ
    if (item.type === 'linebreak' && lastType === 'linebreak') {
      return;
    }
    
    // 最初や最後の改行は除去
    if ((index === 0 || index === structuredContent.length - 1) && item.type === 'linebreak') {
      return;
    }
    
    cleanedContent.push(item);
    lastType = item.type;
  });

  console.log(`Extracted ${cleanedContent.length} structured content items`);
  
  // デバッグ用：抽出された内容の概要をログ出力
  const summary = cleanedContent.reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
  console.log('Content structure summary:', summary);
  
  // 画像の詳細ログ
  const images = cleanedContent.filter(item => item.type === 'image');
  if (images.length > 0) {
    console.log(`Found ${images.length} images in structured content:`);
    images.forEach((img, index) => {
      console.log(`  Image ${index + 1}: ${img.src.substring(0, 80)}...`);
      console.log(`    Alt: "${img.alt}", Title: "${img.title}"`);
      console.log(`    Dimensions: ${img.width}x${img.height}`);
    });
  } else {
    console.warn('No images found in structured content - this might indicate an extraction issue');
    
    // 元要素に画像があるかチェック
    const allImages = element.querySelectorAll('img');
    console.log(`Original element contains ${allImages.length} img tags:`);
    allImages.forEach((img, index) => {
      console.log(`  Original img ${index + 1}: ${img.src.substring(0, 80)}...`);
      console.log(`    Classes: "${img.className}"`);
      console.log(`    Parent tag: ${img.parentElement?.tagName}`);
    });
  }
  
  return cleanedContent;
}

// テキストのクリーニング（改行を保持）
function cleanText(text) {
  if (!text) return '';
  
  return text
    .replace(/\r\n/g, '\n')  // Windows改行を統一
    .replace(/\r/g, '\n')    // Mac改行を統一
    .replace(/[ \t]+/g, ' ') // 複数のスペース・タブを1つに
    .replace(/\n[ \t]+/g, '\n') // 行頭の空白を削除
    .replace(/[ \t]+\n/g, '\n') // 行末の空白を削除
    .replace(/\n{3,}/g, '\n\n') // 3つ以上の連続改行を2つに
    .trim();
}

// 要素のセレクタを生成
function generateSelector(element) {
  if (!element) return '';
  
  // IDがある場合
  if (element.id) {
    return `#${element.id}`;
  }
  
  // クラスがある場合
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(c => c.trim());
    if (classes.length > 0) {
      return `.${classes[0]}`;
    }
  }
  
  // タグ名を使用
  return element.tagName.toLowerCase();
}

// チャット投稿の監視とNotionアイコンの追加
function setupChatPostMonitoring() {
  // 既存の投稿にアイコンを追加
  addNotionIconsToPosts();
  
  // 新しい投稿を監視
  const chatObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // 新しい投稿が追加された場合
            const newPosts = node.querySelectorAll ? node.querySelectorAll(SELECTORS.postContainer) : [];
            if (newPosts.length > 0) {
              console.log(`New posts detected: ${newPosts.length}`);
              setTimeout(() => addNotionIconsToPosts(), 500); // 少し遅延させて確実に追加
            }
            
            // 追加されたノード自体が投稿の場合
            if (node.matches && node.matches(SELECTORS.postContainer)) {
              console.log('New post element detected');
              setTimeout(() => addNotionIconToPost(node), 500);
            }
          }
        });
      }
    });
  });
  
  chatObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
  
  console.log('Chat post monitoring started');
}

// 全ての投稿にNotionアイコンを追加
function addNotionIconsToPosts() {
  try {
    const posts = document.querySelectorAll(SELECTORS.postContainer);
    console.log(`Found ${posts.length} posts to add Notion icons`);
    
    posts.forEach((post, index) => {
      // 既にアイコンが追加されているかチェック
      if (!post.querySelector('.notion-save-icon')) {
        addNotionIconToPost(post, index);
      }
    });
  } catch (error) {
    console.error('Failed to add Notion icons to posts:', error);
  }
}

// 個別の投稿にNotionアイコンを追加
function addNotionIconToPost(postElement, index = 0) {
  try {
    // 投稿が有効かチェック
    if (!postElement || !isValidPost(postElement)) {
      return;
    }
    
    // アイコンコンテナを作成
    const iconContainer = document.createElement('div');
    iconContainer.className = 'notion-save-icon';
    iconContainer.innerHTML = `
      <div class="notion-icon-tooltip">Notionに保存</div>
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path fill="currentColor" d="M4,6H2V20A2,2 0 0,0 4,22H18V20H4V6M20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H8V4H20V16M16,6H18V8H16V6M16,9H18V11H16V9M16,12H18V14H16V12M11,9H15V11H11V9M11,12H15V14H11V12M11,6H15V8H11V6Z"/>
      </svg>
    `;
    
    // スタイルを設定
    iconContainer.style.cssText = `
      position: absolute;
      top: 8px;
      right: 8px;
      width: 32px;
      height: 32px;
      background: rgba(255, 255, 255, 0.9);
      border: 1px solid #e0e0e0;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #666;
      transition: all 0.2s ease;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `;
    
    // ホバー効果のためのイベントリスナー
    iconContainer.addEventListener('mouseenter', () => {
      iconContainer.style.background = '#667eea';
      iconContainer.style.color = 'white';
      iconContainer.style.transform = 'scale(1.1)';
      iconContainer.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.3)';
      
      const tooltip = iconContainer.querySelector('.notion-icon-tooltip');
      tooltip.style.display = 'block';
    });
    
    iconContainer.addEventListener('mouseleave', () => {
      iconContainer.style.background = 'rgba(255, 255, 255, 0.9)';
      iconContainer.style.color = '#666';
      iconContainer.style.transform = 'scale(1)';
      iconContainer.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
      
      const tooltip = iconContainer.querySelector('.notion-icon-tooltip');
      tooltip.style.display = 'none';
    });
    
    // クリックイベント
    iconContainer.addEventListener('click', async (e) => {
      e.stopPropagation();
      e.preventDefault();
      await handleNotionSave(postElement, iconContainer);
    });
    
    // 投稿要素に相対位置を設定
    const computedStyle = window.getComputedStyle(postElement);
    if (computedStyle.position === 'static') {
      postElement.style.position = 'relative';
    }
    
    // アイコンを追加
    postElement.appendChild(iconContainer);
    
    console.log(`Notion icon added to post ${index}`);
    
  } catch (error) {
    console.error('Failed to add Notion icon to post:', error);
  }
}

// 投稿が有効かチェック
function isValidPost(postElement) {
  // 投稿テキストまたは画像が含まれているかチェック
  const hasText = postElement.querySelector(SELECTORS.postText);
  const hasImages = postElement.querySelector(SELECTORS.postImages);
  const hasContent = postElement.textContent && postElement.textContent.trim().length > 10;
  
  return hasText || hasImages || hasContent;
}

// 画像URLが有効かチェック
function isValidImageUrl(url) {
  try {
    // 基本的なURL形式チェック
    if (!url || typeof url !== 'string') {
      return false;
    }
    
    // data:URLは除外
    if (url.startsWith('data:')) {
      return false;
    }
    
    // blob:URLは除外
    if (url.startsWith('blob:')) {
      return false;
    }
    
    // 相対URLは除外（NotionはフルURLが必要）
    if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
      return false;
    }
    
    // HTTPSで始まる必要がある（HTTPは除外）
    if (!url.startsWith('https://')) {
      return false;
    }
    
    // URL長さチェック
    if (url.length > 2000) {
      return false;
    }
    
    // 絵文字やアイコンのSVGファイルを除外
    if (url.includes('emojione') || 
        url.includes('emoji') || 
        url.includes('icon') && url.includes('.svg')) {
      console.log('Skipping emoji/icon SVG:', url);
      return false;
    }
    
    // URLオブジェクトで構文チェック
    const urlObj = new URL(url);
    
    // Notionで問題が起きるドメインをプロキシ経由に変換
    const proxyDomains = [
      'img.youtube.com',
      'lh7-rt.googleusercontent.com',
      'googleusercontent.com'
    ];
    
    // プロキシが必要なドメインかチェック
    const needsProxy = proxyDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.includes(domain)
    );
    
    if (needsProxy) {
      console.log('Converting to proxy URL for Notion compatibility:', url);
      // 無料のプロキシサービスを使用（CORSとSSL対応）
      return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=800&q=85`;
    }
    
    // 安全なドメインのみ許可
    const allowedDomains = [
      'firebasestorage.googleapis.com',
      'storage.googleapis.com',
      'imgur.com',
      'i.imgur.com',
      'libecity.com'
    ];
    
    const isAllowedDomain = allowedDomains.some(domain => 
      urlObj.hostname === domain || urlObj.hostname.endsWith('.' + domain)
    );
    
    if (!isAllowedDomain) {
      console.log('Skipping non-allowed domain:', urlObj.hostname);
      return false;
    }
    
    return true;
    
  } catch (error) {
    console.warn('Invalid image URL:', url, error.message);
    return false;
  }
}

// 要素からコンテンツを抽出する関数
async function extractElementContent(element) {
  try {
    const content = {
      text: '',
      author: '',
      timestamp: '',
      images: [],
      links: [],
      mentions: [],
      url: window.location.href,
      elementInfo: {
        tagName: element.tagName,
        className: element.className,
        id: element.id
      }
    };

    // テキストコンテンツの抽出（改行を保持）
    const textElements = element.querySelectorAll(SELECTORS.postText);
    if (textElements.length > 0) {
      content.text = Array.from(textElements)
        .map(el => {
          // HTMLの改行要素を実際の改行に変換
          let html = el.innerHTML;
          html = html.replace(/<br\s*\/?>/gi, '\n');
          html = html.replace(/<\/p>/gi, '\n');
          html = html.replace(/<p[^>]*>/gi, '');
          html = html.replace(/<div[^>]*>/gi, '\n');
          html = html.replace(/<\/div>/gi, '');
          
          // HTMLタグを除去してテキストのみ取得
          const tempDiv = document.createElement('div');
          tempDiv.innerHTML = html;
          return tempDiv.textContent || tempDiv.innerText || '';
        })
        .map(text => text.trim())
        .filter(text => text.length > 0)
        .join('\n\n');
    } else {
      // フォールバック: 投稿全体のテキスト（改行保持）
      let html = element.innerHTML;
      html = html.replace(/<br\s*\/?>/gi, '\n');
      html = html.replace(/<\/p>/gi, '\n');
      html = html.replace(/<p[^>]*>/gi, '');
      html = html.replace(/<div[^>]*>/gi, '\n');
      html = html.replace(/<\/div>/gi, '');
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      content.text = (tempDiv.textContent || tempDiv.innerText || '').trim();
    }

    // 投稿者情報の抽出
    const authorElement = element.querySelector(SELECTORS.userInfo) || 
                         element.querySelector('.user_name') || 
                         element.querySelector('[class*="user"]') ||
                         element.querySelector('[class*="author"]');
    if (authorElement) {
      content.author = authorElement.textContent.trim();
    }

    // チャットルーム名の抽出（Notionのタイトルプロパティ用）
    // 投稿要素から上位に向かってチャットルーム名を探す
    let chatNameElement = null;
    let currentElement = element;
    
    // 投稿要素内からチャットルーム名を探す
    chatNameElement = element.querySelector('.chat_name') || 
                     element.querySelector('[class*="chat_name"]') ||
                     element.querySelector('[class*="room_name"]') ||
                     element.querySelector('[class*="channel_name"]');
    
    // 投稿要素内にない場合は、親要素を遡って探す
    if (!chatNameElement) {
      while (currentElement && currentElement !== document.body) {
        currentElement = currentElement.parentElement;
        if (currentElement) {
          chatNameElement = currentElement.querySelector('.chat_name') || 
                           currentElement.querySelector('[class*="chat_name"]') ||
                           currentElement.querySelector('[class*="room_name"]') ||
                           currentElement.querySelector('[class*="channel_name"]');
          if (chatNameElement) break;
        }
      }
    }
    
    // 最後にページ全体から探す
    if (!chatNameElement) {
      chatNameElement = document.querySelector('.chat_name') || 
                       document.querySelector('[class*="chat_name"]') ||
                       document.querySelector('[class*="room_name"]') ||
                       document.querySelector('[class*="channel_name"]');
    }
    
    if (chatNameElement) {
      content.chatRoomName = chatNameElement.textContent.trim();
      console.log('Extracted chat room name:', content.chatRoomName);
    } else {
      // フォールバック: ページタイトルから抽出またはURL解析
      let fallbackName = 'libecity チャット';
      
      // ページタイトルからチャット名を抽出を試行
      if (document.title && document.title !== 'libecity') {
        fallbackName = document.title;
      }
      
      // URLからチャット情報を抽出を試行
      const urlMatch = window.location.href.match(/chat[_-]?(\w+)/i);
      if (urlMatch) {
        fallbackName = `${fallbackName} (${urlMatch[1]})`;
      }
      
      content.chatRoomName = fallbackName;
      console.log('Using fallback chat room name:', content.chatRoomName);
    }

    // タイムスタンプの抽出（<time>タグを優先、時刻まで含めて取得、タイムゾーン考慮）
    const timeElement = element.querySelector('time') ||
                       element.querySelector(SELECTORS.timestamp) || 
                       element.querySelector('[class*="time"]') || 
                       element.querySelector('[class*="date"]') ||
                       element.querySelector('[datetime]');
    if (timeElement) {
      // datetime属性がある場合はそれを使用、なければテキストコンテンツ
      let timestamp = timeElement.getAttribute('datetime') || timeElement.textContent.trim();
      
      // 時刻フォーマットを統一（YYYY/MM/DD HH:MM形式）、タイムゾーン考慮
      if (timestamp) {
        // libecity.comの時刻フォーマット（YYYY/MM/DD HH:MM）に対応
        const dateMatch = timestamp.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
        if (dateMatch) {
          const [, year, month, day, hour, minute] = dateMatch;
          
          // 日本時間として表示用文字列を作成
          const localTimeString = `${year}/${month.padStart(2, '0')}/${day.padStart(2, '0')} ${hour.padStart(2, '0')}:${minute}`;
          
          // Notion API用: 日本時間をUTC時刻に変換（Notionが自動でローカル時間として解釈するため）
          const japanDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute}:00+09:00`);
          const utcISOString = japanDate.toISOString(); // UTC時刻
          
          // タイムゾーン情報付きで保存
          content.timestamp = localTimeString; // 表示用（日本時間）
          content.timestampISO = utcISOString; // Notion API用（UTC時刻、タイムゾーンなし）
          content.timezone = null; // タイムゾーン指定なし
          
                      console.log('Processed libecity timestamp:', {
            original: timestamp,
            local: localTimeString,
            utcISO: utcISOString,
            timezone: content.timezone,
            note: 'Sending UTC time without timezone specification (Notion will display in user timezone)'
          });
        } else {
          // その他のフォーマットの場合
          console.warn('Unexpected timestamp format:', timestamp);
          content.timestamp = timestamp;
        }
      }
      console.log('Extracted timestamp:', content.timestamp);
    }

    // 画像の抽出（プロキシ変換対応）
    // 構造化コンテンツがある場合は、そちらに含まれているのでスキップ
    if (content.structuredContent && content.structuredContent.length > 0) {
      console.log('Skipping separate image extraction - images included in structured content');
      content.images = []; // 重複を避けるため空にする
    } else {
      try {
        console.log('Extracting images with proxy conversion support');
        const imageElements = element.querySelectorAll('img');
        console.log(`Found ${imageElements.length} total images in element`);
        
        content.images = Array.from(imageElements)
          .map((img, index) => {
            if (!img.src) return null;
            
            const validatedUrl = isValidImageUrl(img.src);
            if (!validatedUrl) return null;
            
            console.log(`Image ${index + 1} processed:`, {
              src: img.src.substring(0, 100) + '...',
              className: img.className,
              alt: img.alt,
              finalUrl: typeof validatedUrl === 'string' ? validatedUrl.substring(0, 100) + '...' : 'valid'
            });
            
            return {
              src: typeof validatedUrl === 'string' ? validatedUrl : img.src, // プロキシURLまたは元URL
              alt: img.alt || '',
              title: img.title || '',
              className: img.className || '',
              width: img.naturalWidth || img.width || 0,
              height: img.naturalHeight || img.height || 0
            };
          })
          .filter(img => img !== null)
          .slice(0, 5); // 最大5個まで
        
        console.log(`Successfully extracted ${content.images.length} valid images`);
        
      } catch (imageError) {
        console.error('Failed to extract images:', imageError);
        content.images = []; // エラー時は空配列
      }
    }

    // リンクの抽出（URLリンク付きテキストを含む）
    const links = element.querySelectorAll('a[href]');
    content.links = Array.from(links)
      .filter(link => {
        // javascript:リンクやemptyリンクを除外
        return link.href && 
               !link.href.startsWith('javascript:') && 
               !link.href.startsWith('#') &&
               link.href.length > 0;
      })
      .map(link => {
        const linkText = link.textContent.trim();
        const linkUrl = link.href;
        
        // リンクに含まれる画像も取得
        const linkImages = link.querySelectorAll('img');
        const images = Array.from(linkImages).map(img => ({
          src: img.src,
          alt: img.alt || '',
          title: img.title || ''
        }));
        
        return {
          url: linkUrl,
          text: linkText,
          title: link.title || '',
          target: link.target || '',
          images: images,
          isImageLink: linkImages.length > 0,
          // リンクの種類を判定
          type: linkUrl.includes('youtube.com') || linkUrl.includes('youtu.be') ? 'youtube' :
                linkUrl.includes('twitter.com') || linkUrl.includes('x.com') ? 'twitter' :
                linkUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? 'image' :
                'general'
        };
      });
    
    console.log(`Found ${content.links.length} links:`, content.links);

    // メンションの抽出
    const mentions = element.querySelectorAll('[class*="mention"], [data-mention]');
    content.mentions = Array.from(mentions).map(mention => ({
      text: mention.textContent.trim(),
      userId: mention.dataset.userId || '',
      userName: mention.dataset.userName || ''
    }));

    // 構造化コンテンツの生成（テキスト、画像、リンクを順序通りに）
    try {
      console.log('Extracting structured content...');
      content.structuredContent = extractStructuredContent(element);
      console.log(`Generated ${content.structuredContent.length} structured blocks`);
      
      // 構造化コンテンツが正常に抽出された場合、詳細ログを出力
      if (content.structuredContent.length > 0) {
        const contentSummary = content.structuredContent.reduce((acc, item) => {
          acc[item.type] = (acc[item.type] || 0) + 1;
          return acc;
        }, {});
        console.log('Structured content summary:', contentSummary);
      }
    } catch (error) {
      console.error('Failed to extract structured content:', error);
      content.structuredContent = [];
    }

    console.log('Extracted content:', content);
    return content;

  } catch (error) {
    console.error('Failed to extract element content:', error);
    throw error;
  }
}

// コンテンツの検証とクリーンアップ
function validateAndCleanContent(content) {
  try {
    const cleanedContent = { ...content };
    
    // 画像配列の安全性チェック
    if (cleanedContent.images && Array.isArray(cleanedContent.images)) {
      // 既に抽出時に検証済みなので、基本的なチェックのみ
      cleanedContent.images = cleanedContent.images.filter(image => {
        return image && image.src && typeof image.src === 'string';
      }).slice(0, 5); // 最大5個まで
      
      console.log(`Cleaned images: ${cleanedContent.images.length} valid`);
    } else {
      cleanedContent.images = [];
    }
    
    // リンク配列の安全性チェック
    if (cleanedContent.links && Array.isArray(cleanedContent.links)) {
      cleanedContent.links = cleanedContent.links.filter(link => {
        return link && link.url && typeof link.url === 'string';
      }).slice(0, 10); // 最大10個まで
      
      console.log(`Cleaned links: ${cleanedContent.links.length} valid`);
    } else {
      cleanedContent.links = [];
    }
    
    // テキストの長さ制限
    if (cleanedContent.text && cleanedContent.text.length > 10000) {
      console.warn('Text too long, truncating');
      cleanedContent.text = cleanedContent.text.substring(0, 9900) + '...(truncated)';
    }
    
    // 必須フィールドの確保
    cleanedContent.text = cleanedContent.text || 'コンテンツが見つかりません';
    cleanedContent.author = cleanedContent.author || '不明';
    cleanedContent.timestamp = cleanedContent.timestamp || new Date().toISOString();
    
    return cleanedContent;
    
  } catch (error) {
    console.error('Error in validateAndCleanContent:', error);
    // エラー時は最小限のコンテンツを返す
    return {
      text: content.text || 'コンテンツが見つかりません',
      author: content.author || '不明',
      timestamp: content.timestamp || new Date().toISOString(),
      images: [],
      links: [],
      mentions: [],
      url: content.url || window.location.href
    };
  }
}

// Notion保存の処理
async function handleNotionSave(postElement, iconElement) {
  try {
    // Chrome拡張機能APIの利用可能性をチェック
    if (!chrome || !chrome.storage || !chrome.runtime) {
      throw new Error('Chrome拡張機能APIが利用できません。ページを再読み込みしてください。');
    }
    
    // アイコンの状態を保存中に変更
    iconElement.style.background = '#ffc107';
    iconElement.style.color = 'white';
    iconElement.innerHTML = `
      <div class="notion-icon-tooltip">保存中...</div>
      <div style="width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top: 2px solid white; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    `;
    
    // ツールチップを強制表示
    const tooltip = iconElement.querySelector('.notion-icon-tooltip');
    if (tooltip) {
      tooltip.style.display = 'block';
    }
    
    // コンテンツを抽出
    const content = await extractElementContent(postElement);
    
    // コンテンツの検証とクリーンアップ
    const cleanedContent = validateAndCleanContent(content);
    console.log('Cleaned content for Notion:', cleanedContent);
    
    // 保存先データベースを取得
    let databaseId;
    try {
      const settings = await chrome.storage.sync.get(['selectedDatabase']);
      databaseId = settings.selectedDatabase;
    } catch (error) {
      console.error('Failed to get storage settings:', error);
      throw new Error('設定の取得に失敗しました。拡張機能の権限を確認してください。');
    }
    
    if (!databaseId) {
      throw new Error('保存先データベースが選択されていません。拡張機能の設定を確認してください。');
    }
    
    // Notionに保存（クリーンアップされたコンテンツを使用）
    let response;
    try {
      response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
          action: 'saveToNotion',
          databaseId: databaseId,
          content: cleanedContent
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
    } catch (error) {
      console.error('Failed to send message to background script:', error);
      throw new Error('バックグラウンドスクリプトとの通信に失敗しました。拡張機能を再読み込みしてください。');
    }
    
    if (response && response.success) {
      // 成功時のアイコン表示
      iconElement.style.background = '#28a745';
      iconElement.style.color = 'white';
      iconElement.innerHTML = `
        <div class="notion-icon-tooltip">保存完了!</div>
        <svg viewBox="0 0 24 24" width="16" height="16">
          <path fill="white" d="M9,20.42L2.79,14.21L5.62,11.38L9,14.77L18.88,4.88L21.71,7.71L9,20.42Z"/>
        </svg>
      `;
      
      // 成功時のツールチップを一時的に表示
      const successTooltip = iconElement.querySelector('.notion-icon-tooltip');
      if (successTooltip) {
        successTooltip.style.display = 'block';
        setTimeout(() => {
          successTooltip.style.display = 'none';
        }, 2000);
      }
      
      // 3秒後に元のアイコンに戻す
      setTimeout(() => {
        iconElement.style.background = 'rgba(255, 255, 255, 0.9)';
        iconElement.style.color = '#666';
        iconElement.innerHTML = `
          <div class="notion-icon-tooltip">Notionに保存</div>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path fill="currentColor" d="M4,6H2V20A2,2 0 0,0 4,22H18V20H4V6M20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H8V4H20V16M16,6H18V8H16V6M16,9H18V11H16V9M16,12H18V14H16V12M11,9H15V11H11V9M11,12H15V14H11V12M11,6H15V8H11V6Z"/>
          </svg>
        `;
      }, 3000);
      
      console.log('Post saved to Notion successfully');
      
    } else {
      throw new Error(response?.error || '保存に失敗しました');
    }
    
  } catch (error) {
    console.error('Failed to save post to Notion:', error);
    
    // エラー時のアイコン表示
    iconElement.style.background = '#dc3545';
    iconElement.style.color = 'white';
    iconElement.innerHTML = `
      <div class="notion-icon-tooltip">保存エラー: ${error.message}</div>
      <svg viewBox="0 0 24 24" width="16" height="16">
        <path fill="white" d="M13,14H11V10H13M13,18H11V16H13M1,21H23L12,2L1,21Z"/>
      </svg>
    `;
    
    // エラー時のツールチップを一時的に表示
    const errorTooltip = iconElement.querySelector('.notion-icon-tooltip');
    if (errorTooltip) {
      errorTooltip.style.display = 'block';
      setTimeout(() => {
        errorTooltip.style.display = 'none';
      }, 4000);
    }
    
    // 5秒後に元のアイコンに戻す
    setTimeout(() => {
      iconElement.style.background = 'rgba(255, 255, 255, 0.9)';
      iconElement.style.color = '#666';
      iconElement.innerHTML = `
        <div class="notion-icon-tooltip">Notionに保存</div>
        <svg viewBox="0 0 24 24" width="18" height="18">
          <path fill="currentColor" d="M4,6H2V20A2,2 0 0,0 4,22H18V20H4V6M20,2H8A2,2 0 0,0 6,4V16A2,2 0 0,0 8,18H20A2,2 0 0,0 22,16V4A2,2 0 0,0 20,2M20,16H8V4H20V16M16,6H18V8H16V6M16,9H18V11H16V9M16,12H18V14H16V12M11,9H15V11H11V9M11,12H15V14H11V12M11,6H15V8H11V6Z"/>
        </svg>
      `;
    }, 5000);
  }
}

// CSSスタイルを追加
function addNotionIconStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .notion-save-icon {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    }
    
    .notion-icon-tooltip {
      position: absolute;
      bottom: 40px;
      right: 0;
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      white-space: nowrap;
      display: none;
      z-index: 10000;
      pointer-events: none;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      transition: opacity 0.2s ease;
    }
    
    .notion-icon-tooltip::after {
      content: '';
      position: absolute;
      top: 100%;
      right: 12px;
      border: 4px solid transparent;
      border-top-color: rgba(0, 0, 0, 0.8);
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .notion-save-icon:hover .notion-icon-tooltip {
      display: block !important;
    }
    
    .notion-save-icon svg {
      transition: transform 0.2s ease;
    }
    
    .notion-save-icon:hover svg {
      transform: scale(1.1);
    }
  `;
  document.head.appendChild(style);
}

// 初期化の実行
initialize();

// スタイルを追加
addNotionIconStyles(); 