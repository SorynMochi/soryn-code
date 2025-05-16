  // Model: Store novels data
  let novels = [];
  let currentNovelIndex = -1;
  let currentCharacterIndex = -1;
  let currentLoreIndex = -1;
  let characterImagesData = []; // Store multiple character images
  let loreImagesData = []; // Store multiple lore images
  let currentImageIndex = -1; // Track which image is being edited/uploaded
  let novelCoverData = null; // Store the novel cover image data
  // Current chapter being summarized
  let summaryChapterIndex = -1;

  // Track currently selected image
  let selectedImage = null;
  
  // Track chapter list collapsed state
  let chaptersCollapsed = false;
  // Track character list collapsed state
  let charactersCollapsed = false;
  // Track lore list collapsed state
  let loreCollapsed = false;
  
  // Track if there's an ongoing save operation
  let saveTimeout = null;
  
  // Track drag and drop operations
  let draggedItem = null;
  
  // Timer variables
  let timerInterval = null;
  let timerEndTime = null;

  // Timeline variables
  let timelineCollapsed = false;
  let currentTimelineEventIndex = -1;
  let timelineSettings = {
    eras: [{ name: 'Current Era', abbreviation: 'CE' }],
    months: [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ],
    daysInWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    daysPerMonth: [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31],
    viewMode: 'horizontal'
  };

  // IndexedDB Configuration
  const DB_NAME = 'novelAppDB';
  const DB_VERSION = 1;
  let db = null;

  // Initialize IndexedDB
  function initDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = (event) => {
        console.error("Error opening database:", event.target.error);
        reject(event.target.error);
      };
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains('novels')) {
          db.createObjectStore('novels');
        }
        
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }
      };
      
      request.onsuccess = (event) => {
        db = event.target.result;
        resolve(db);
      };
    });
  }

  // Save data to IndexedDB
  async function saveToIndexedDB(storeName, key, data) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], "readwrite");
      const store = transaction.objectStore(storeName);
      const request = store.put(data, key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Get data from IndexedDB
  async function getFromIndexedDB(storeName, key) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Check if a key exists in IndexedDB
  async function keyExistsInIndexedDB(storeName, key) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count(key);
      
      request.onsuccess = () => resolve(request.result > 0);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all entries from a store in IndexedDB
  async function getAllFromIndexedDB(storeName) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Get all keys from a store in IndexedDB
  async function getAllKeysFromIndexedDB(storeName) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAllKeys();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Delete data from IndexedDB
  async function deleteFromIndexedDB(storeName, key) {
    if (!db) await initDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Initialize the app
  async function init() {
    // Initialize IndexedDB
    await initDB();
    
    // Check if there are saved novels
    const novelsExist = await keyExistsInIndexedDB('novels', 'novelsData');
    if (novelsExist) {
      await loadNovels();
    } else {
      // Add first novel with first chapter
      addNovel();
    }
    
    // Add word count functionality
    editor.addEventListener('input', function() {
      updateWordCount();
      autoSaveEdit();
    });
    editor.setAttribute('placeholder', 'Start writing your chapter here...');
    
    // Update UI for mobile
    updateMobileUI();
    
    // Add keyboard shortcut listeners for common formatting operations
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Add image file change listener
    imageFile.addEventListener('change', previewImage);
    
    // Add image selection event listener
    editor.addEventListener('click', handleEditorClick);
    
    // Listen for custom size option changes
    imageSizeSelect.addEventListener('change', function() {
      if (this.value === 'custom') {
        customSizeControls.style.display = 'inline-flex';
      } else {
        customSizeControls.style.display = 'none';
      }
    });
    
    // Handle clicks outside the editor to deselect images
    document.addEventListener('click', function(e) {
      if (!editor.contains(e.target) && e.target !== imageEditingToolbar && !imageEditingToolbar.contains(e.target)) {
        deselectAllImages();
        closeImageEditingToolbar();
      }
    });
    
    // Add smart quotes functionality to the editor
    setupSmartQuotes(editor);
    
    // Add smart quotes for pasted content
    setupSmartQuotesPaste(editor);
    
    // Add auto-replace functionality for ellipsis and em dash
    setupAutoReplace(editor);
    
    // Initialize character images container
    refreshImagesContainer();
    
    // Initialize lore images container
    refreshLoreImagesContainer();
    
    // Set up category-specific fields toggle for lore entries
    loreCategory.addEventListener('change', function() {
      toggleLoreCategoryFields();
      if (this.value === 'Custom') {
        customCategoryContainer.style.display = 'block';
      } else {
        customCategoryContainer.style.display = 'none';
      }
    });
    
    // Show novel list by default when loading the page
    showNovelList();
    
    // Setup import file listener
    importFile.addEventListener('change', handleImportFile);
    
    // Initialize theme
    await initTheme();
    
    // Add Tab key handler to editor
    editor.addEventListener('keydown', function(e) {
      if (e.key === 'Tab') {
        e.preventDefault(); // Prevent default tab behavior (focus change)
        
        // Insert a tab character at the current cursor position
        document.execCommand('insertText', false, '\t');
      }
    });
    
    // Set up event listeners
    setupEventListeners();
  }
  
  // Set up all event listeners
  function setupEventListeners() {
    // Menu and sidebar controls
    document.getElementById('menuBtn').addEventListener('click', toggleMenu);
    document.getElementById('showNovelListBtn').addEventListener('click', showNovelList);
    document.getElementById('toggleChapters').addEventListener('click', toggleChapterList);
    document.getElementById('addChapterBtn').addEventListener('click', addChapter);
    document.getElementById('toggleCharacters').addEventListener('click', toggleCharacterList);
    document.getElementById('addCharacterBtn').addEventListener('click', addCharacter);
    document.getElementById('toggleLore').addEventListener('click', toggleLoreList);
    document.getElementById('addLoreBtn').addEventListener('click', addLore);
    document.getElementById('timelinebtn').addEventListener('click', openTimeline);
    document.getElementById('addNovelBtn').addEventListener('click', addNovel);
    document.getElementById('toggleSidebarBtn').addEventListener('click', toggleSidebar);
    
    // Character editor
    document.getElementById('closeCharacterBtn').addEventListener('click', closeCharacterEditor);
    document.getElementById('addCharacterImageBtn').addEventListener('click', addCharacterImage);
    document.getElementById('charImageInput').addEventListener('change', function() { 
      previewCharacterImage(this);
    });
    document.getElementById('characterForm').addEventListener('submit', function(event) {
      saveCharacter(event);
    });
    
    // Lore editor
    document.getElementById('closeLoreBtn').addEventListener('click', closeLoreEditor);
    document.getElementById('addLoreImageBtn').addEventListener('click', addLoreImage);
    document.getElementById('loreImageInput').addEventListener('change', function() {
      previewLoreImage(this);
    });
    document.getElementById('loreForm').addEventListener('submit', function(event) {
      saveLore(event);
    });
    
    // Novel editor
    document.getElementById('closeNovelEditorBtn').addEventListener('click', closeNovelEditor);
    document.getElementById('novelCoverPreviewContainer').addEventListener('click', function() {
      document.getElementById('novelCoverInput').click();
    });
    document.getElementById('novelCoverInput').addEventListener('change', function() {
      previewNovelCover(this);
    });
    document.getElementById('uploadCoverBtn').addEventListener('click', function() {
      document.getElementById('novelCoverInput').click();
    });
    document.getElementById('removeCoverBtn').addEventListener('click', removeNovelCover);
    document.getElementById('novelForm').addEventListener('submit', function(event) {
      saveNovelDetails(event);
    });
    
    // Format toolbar
    document.getElementById('formatSelect').addEventListener('change', function() {
      formatText('formatBlock', this.value);
    });
    document.getElementById('fontSelect').addEventListener('change', function() {
      formatText('fontName', this.value);
    });
    document.getElementById('sizeSelect').addEventListener('change', function() {
      formatText('fontSize', this.value);
    });
    document.getElementById('boldFormatBtn').addEventListener('click', function() {
      formatText('bold');
    });
    document.getElementById('italicFormatBtn').addEventListener('click', function() {
      formatText('italic');
    });
    document.getElementById('underlineFormatBtn').addEventListener('click', function() {
      formatText('underline');
    });
    document.getElementById('strikeFormatBtn').addEventListener('click', function() {
      formatText('strikeThrough');
    });
    document.getElementById('superscriptFormatBtn').addEventListener('click', function() {
      formatText('superscript');
    });
    document.getElementById('subscriptFormatBtn').addEventListener('click', function() {
      formatText('subscript');
    });
    
    // Colors
    document.getElementById('textColorBtn').addEventListener('click', showTextColorModal);
    document.getElementById('bgColorBtn').addEventListener('click', showBgColorModal);
    
    // Alignment
    document.getElementById('alignLeftBtn').addEventListener('click', function() {
      formatText('justifyLeft');
    });
    document.getElementById('alignCenterBtn').addEventListener('click', function() {
      formatText('justifyCenter');
    });
    document.getElementById('alignRightBtn').addEventListener('click', function() {
      formatText('justifyRight');
    });
    document.getElementById('alignJustifyBtn').addEventListener('click', function() {
      formatText('justifyFull');
    });
    
    // Lists
    document.getElementById('bulletListBtn').addEventListener('click', function() {
      formatText('insertUnorderedList');
    });
    document.getElementById('numberedListBtn').addEventListener('click', function() {
      formatText('insertOrderedList');
    });
    document.getElementById('indentBtn').addEventListener('click', function() {
      formatText('indent');
    });
    document.getElementById('outdentBtn').addEventListener('click', function() {
      formatText('outdent');
    });
    
    // Insert elements
    document.getElementById('insertLinkBtn').addEventListener('click', insertLink);
    document.getElementById('insertImageBtn').addEventListener('click', insertImage);
    document.getElementById('insertTableBtn').addEventListener('click', insertTable);
    document.getElementById('insertHrBtn').addEventListener('click', insertHorizontalRule);
    document.getElementById('specialCharBtn').addEventListener('click', showSpecialCharacters);
    
    // Utilities
    document.getElementById('undoBtn').addEventListener('click', function() {
      formatText('undo');
    });
    document.getElementById('redoBtn').addEventListener('click', function() {
      formatText('redo');
    });
    document.getElementById('clearFormatBtn').addEventListener('click', function() {
      formatText('removeFormat');
    });
    document.getElementById('smartQuotesBtn').addEventListener('click', convertAllQuotesToSmartQuotes);
    
    // AI and timer
    document.getElementById('AIgen').addEventListener('click', function() {
      useAI(true);
    });
    document.getElementById('timerBtn').addEventListener('click', openTimerModal);
    document.getElementById('cancelTimerBtn').addEventListener('click', cancelTimer);
    
    // Export
    document.getElementById('toggleExportBtn').addEventListener('click', toggleExportMenu);
    document.getElementById('exportWordBtn').addEventListener('click', exportAsWord);
    document.getElementById('exportPdfBtn').addEventListener('click', exportAsPdf);
    document.getElementById('exportTxtBtn').addEventListener('click', exportAsTxt);
    
    // Theme
    document.getElementById('themeSelect').addEventListener('change', function() {
      setTheme(this.value);
    });
    
    // Backup/Import
    document.getElementById('backupbtn').addEventListener('click', exportAllData);
    document.getElementById('importbtn').addEventListener('click', importData);
    
    // Image modal
    document.getElementById('urlTabBtn').addEventListener('click', function() {
      switchImageTab('url');
    });
    document.getElementById('uploadTabBtn').addEventListener('click', function() {
      switchImageTab('upload');
    });
    document.getElementById('closeImageModalBtn').addEventListener('click', closeImageModal);
    document.getElementById('insertImageBtn').addEventListener('click', confirmInsertImage);
    
    // Special characters modal
    document.getElementById('closeSpecialCharModalBtn').addEventListener('click', closeSpecialCharModal);
    // Add event listeners for all special character buttons
    document.querySelectorAll('.special-char-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        insertSpecialChar(this.textContent);
      });
    });
    
    // Text color modal
    document.getElementById('applyTextColorBtn').addEventListener('click', function() {
      applyTextColor(textColorModalPicker.value);
    });
    document.getElementById('unsetTextColorBtn').addEventListener('click', unsetTextColor);
    document.getElementById('closeTextColorModalBtn').addEventListener('click', closeTextColorModal);
    
    // Background color modal
    document.getElementById('applyBgColorBtn').addEventListener('click', function() {
      applyBgColor(bgColorModalPicker.value);
    });
    document.getElementById('unsetBgColorBtn').addEventListener('click', unsetBgColor);
    document.getElementById('closeBgColorModalBtn').addEventListener('click', closeBgColorModal);
    
    // Image editing toolbar
    document.getElementById('applyCustomSizeBtn').addEventListener('click', applyCustomSize);
    document.getElementById('imgAlignLeftBtn').addEventListener('click', function() {
      applyImageEdit('align', 'left');
    });
    document.getElementById('imgAlignCenterBtn').addEventListener('click', function() {
      applyImageEdit('align', 'center');
    });
    document.getElementById('imgAlignRightBtn').addEventListener('click', function() {
      applyImageEdit('align', 'right');
    });
    document.getElementById('imgFloatLeftBtn').addEventListener('click', function() {
      applyImageEdit('float', 'left');
    });
    document.getElementById('imgFloatRightBtn').addEventListener('click', function() {
      applyImageEdit('float', 'right');
    });
    document.getElementById('imgFloatNoneBtn').addEventListener('click', function() {
      applyImageEdit('float', 'none');
    });
    document.getElementById('applyImageBorderBtn').addEventListener('click', function() {
      applyImageEdit('border');
    });
    document.getElementById('applyImagePaddingBtn').addEventListener('click', function() {
      applyImageEdit('padding');
    });
    document.getElementById('applyImageAltBtn').addEventListener('click', function() {
      applyImageEdit('alt');
    });
    document.getElementById('removeImageBtn').addEventListener('click', function() {
      applyImageEdit('remove');
    });
    document.getElementById('closeImageEditingToolbarBtn').addEventListener('click', closeImageEditingToolbar);
    
    // Image preview modals
    document.getElementById('closeImagePreviewModalBtn').addEventListener('click', closeImagePreviewModal);
    document.getElementById('closeLoreImagePreviewModalBtn').addEventListener('click', closeLoreImagePreviewModal);
    
    // Summary modal
    document.getElementById('closeSummaryModalBtn').addEventListener('click', closeSummaryModal);
    document.getElementById('generateSummaryBtn').addEventListener('click', function() {
      generateChapterSummary(true);
    });
    document.getElementById('summarysave').addEventListener('click', saveChapterSummary);
    
    // Timer modal
    document.getElementById('startTimerBtn').addEventListener('click', startTimer);
    document.getElementById('closeTimerModalBtn').addEventListener('click', closeTimerModal);
    
    // Timeline
    document.getElementById('closeTimelineBtn').addEventListener('click', closeTimeline);
    document.getElementById('addTimelineEventBtn').addEventListener('click', addTimelineEvent);
    document.getElementById('timelineViewMode').addEventListener('change', function() {
      switchTimelineView(this.value);
    });
    document.getElementById('timelineSettingsBtn').addEventListener('click', openTimelineSettings);
    document.getElementById('closeTimelineEventModalBtn').addEventListener('click', closeTimelineEventModal);
    document.getElementById('timelineEventForm').addEventListener('submit', function(event) {
      saveTimelineEvent(event);
    });
    document.getElementById('addEraBtn').addEventListener('click', addEra);
    document.getElementById('numMonths').addEventListener('change', updateMonthsInputs);
    document.getElementById('numDaysInWeek').addEventListener('change', updateDaysInputs);
    document.getElementById('closeTimelineSettingsBtn').addEventListener('click', closeTimelineSettings);
    document.getElementById('timelineSettingsForm').addEventListener('submit', function(event) {
      saveTimelineSettings(event);
    });
    
    // Delete timeline event button
    document.getElementById('deleteTimelineEventBtn').addEventListener('click', deleteTimelineEvent);
  }
  
  // Theme functionality
  async function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    await saveToIndexedDB('settings', 'theme', theme);
    
    // Update the select dropdown
    if (themeSelect) {
      themeSelect.value = theme;
      menuDropdown.style.display = 'none';
    }
  }
  
  async function initTheme() {
    const savedTheme = await getFromIndexedDB('settings', 'theme') || 'light';
    setTheme(savedTheme);
  }
  
  // Toggle sidebar visibility
  function toggleSidebar() {
    if (sidebar.style.display === 'none') {
      sidebar.style.display = 'block';
    } else {
      sidebar.style.display = 'none';
    }
  }
  
  // Auto save when editing content
  function autoSaveEdit() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(function() {
      saveCurrentChapter();
      saveToIndexedDB('novels', 'novelsData', novels);
    }, 1000); // Save after 1 second of inactivity
  }
  
  // Toggle the chapter list collapse/expand
  function toggleChapterList() {
    chaptersCollapsed = !chaptersCollapsed;
    
    if (chaptersCollapsed) {
      chapterListContainer.style.display = 'none';
      toggleChapters.textContent = '▶';
    } else {
      chapterListContainer.style.display = 'block';
      toggleChapters.textContent = '▼';
    }
  }
  
  // Toggle the character list collapse/expand
  function toggleCharacterList() {
    charactersCollapsed = !charactersCollapsed;
    
    if (charactersCollapsed) {
      characterListContainer.style.display = 'none';
      toggleCharacters.textContent = '▶';
    } else {
      characterListContainer.style.display = 'block';
      toggleCharacters.textContent = '▼';
    }
  }
  
  // Toggle the lore list collapse/expand
  function toggleLoreList() {
    loreCollapsed = !loreCollapsed;
    
    if (loreCollapsed) {
      loreListContainer.style.display = 'none';
      toggleLore.textContent = '▶';
    } else {
      loreListContainer.style.display = 'block';
      toggleLore.textContent = '▼';
    }
  }
  
  // Convert all straight quotes in the editor to smart quotes
  function convertAllQuotesToSmartQuotes() {
    // Save current selection
    const selection = window.getSelection();
    const savedRanges = [];
    for (let i = 0; i < selection.rangeCount; i++) {
      savedRanges.push(selection.getRangeAt(i).cloneRange());
    }
    
    // Get all text nodes in the editor
    const textNodes = [];
    const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    
    // Process each text node
    textNodes.forEach(node => {
      node.textContent = convertToSmartQuotes(node.textContent);
    });
    
    // Restore selection
    selection.removeAllRanges();
    savedRanges.forEach(range => selection.addRange(range));
    
    // Save changes
    autoSaveEdit();
  }
  
  // Function to handle smart quotes conversion when pasting
  function setupSmartQuotesPaste(editorEl) {
    editorEl.addEventListener('paste', function(e) {
      // Get plain text from clipboard
      let clipboardData = e.clipboardData || window.clipboardData;
      let pastedText = clipboardData.getData('text/plain');
      
      // Process the text to convert quotes
      let processedText = convertToSmartQuotes(pastedText);
      
      // If the text changed, use our processed version
      if (pastedText !== processedText) {
        e.preventDefault();
        document.execCommand('insertText', false, processedText);
      }
      // Otherwise, let the default paste behavior happen
    });
  }
  
  // Function to convert regular quotes to smart quotes in text
  function convertToSmartQuotes(text) {
    let result = '';
    
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (char === '"' || char === "'") {
        // Get the text before this quote
        const textBefore = text.substring(0, i);
        
        // Get the last character of the text before this quote
        const lastChar = textBefore.slice(-1);
        
        // Determine if opening or closing quote
        // Use opening quote at start of text, after spaces, or after typical opening punctuation
        const isOpeningQuote = !lastChar || /[\s\(\[\{\-]/.test(lastChar);
        
        // Choose appropriate quote character
        let smartQuote;
        if (char === '"') {
          smartQuote = isOpeningQuote ? '\u201C' : '\u201D'; // Open or close double quote
        } else {
          smartQuote = isOpeningQuote ? '\u2018' : '\u2019'; // Open or close single quote
        }
        
        result += smartQuote;
      } else {
        result += char;
      }
    }
    
    return result;
  }
  
  // Function to handle auto-replacement of ... with ellipsis and -- with em dash
  function setupAutoReplace(editorEl) {
    editorEl.addEventListener('input', function(e) {
      // Only proceed if this was text input
      if (e.inputType === 'insertText') {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        
        const range = selection.getRangeAt(0);
        const node = range.startContainer;
        
        // Only works directly in text nodes
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent;
          const pos = range.startOffset;
          
          // Check for ellipsis pattern (...)
          if (e.data === '.' && pos >= 3 && text.substring(pos - 3, pos) === '...') {
            // Replace the three dots with an ellipsis character
            const before = text.substring(0, pos - 3);
            const after = text.substring(pos);
            node.textContent = before + '…' + after;
            
            // Move the cursor to after the ellipsis
            range.setStart(node, pos - 2);  // -3 for ... +1 for …
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
          
          // Check for em dash pattern (--)
          else if (e.data === '-' && pos >= 2 && text.substring(pos - 2, pos) === '--') {
            // Replace the two hyphens with an em dash character
            const before = text.substring(0, pos - 2);
            const after = text.substring(pos);
            node.textContent = before + '—' + after;
            
            // Move the cursor to after the em dash
            range.setStart(node, pos - 1);  // -2 for -- +1 for —
            range.collapse(true);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        }
      }
    });
  }
  
  // Function to handle smart quotes conversion
  function setupSmartQuotes(editorEl) {
    editorEl.addEventListener('keydown', function(e) {
      if (e.key === '"' || e.key === "'") {
        e.preventDefault();
        
        // Get the surrounding text to determine context
        const selection = window.getSelection();
        const range = selection.getRangeAt(0);
        
        // Get text before cursor
        let textBefore = '';
        if (range.startContainer.nodeType === Node.TEXT_NODE) {
          textBefore = range.startContainer.textContent.substring(0, range.startOffset);
        }
        
        // Determine if opening or closing quote
        // Use opening quote at start of text, after spaces, or after typical opening punctuation
        const lastChar = textBefore.slice(-1);
        const isOpeningQuote = !lastChar || /[\s\(\[\{\-]/.test(lastChar);
        
        // Choose appropriate quote character
        let smartQuote;
        if (e.key === '"') {
          smartQuote = isOpeningQuote ? '\u201C' : '\u201D'; // Open or close double quote
        } else {
          smartQuote = isOpeningQuote ? '\u2018' : '\u2019'; // Open or close single quote
        }
        
        // Insert the smart quote
        document.execCommand('insertText', false, smartQuote);
      }
    });
  }
  
  // Handle clicks within the editor
  function handleEditorClick(e) {
    // Check if an image was clicked
    if (e.target.tagName === 'IMG') {
      e.preventDefault();
      selectImage(e.target);
    } else {
      // If clicked elsewhere in the editor, deselect any selected image
      deselectAllImages();
      closeImageEditingToolbar();
    }
  }
  
  // Select an image and show the editing toolbar
  function selectImage(img) {
    // Deselect any previously selected image
    deselectAllImages();
    
    // Mark the image as selected
    selectedImage = img;
    img.classList.add('selected');
    
    // Position and show the image editing toolbar
    positionImageToolbar(img);
    
    // Populate the toolbar with the image's current properties
    populateImageToolbar(img);
  }
  
  // Deselect all images
  function deselectAllImages() {
    const images = editor.querySelectorAll('img.selected');
    images.forEach(img => img.classList.remove('selected'));
    selectedImage = null;
  }
  
  // Position the image editing toolbar near the selected image
  function positionImageToolbar(img) {
    const imgRect = img.getBoundingClientRect();
    const editorRect = editor.getBoundingClientRect();
    
    // Position the toolbar above the image
    imageEditingToolbar.style.left = (imgRect.left + window.scrollX) + 'px';
    imageEditingToolbar.style.top = (imgRect.top + window.scrollY - imageEditingToolbar.offsetHeight - 10) + 'px';
    
    // Check if toolbar would be outside the viewport or editor
    if (imgRect.top - imageEditingToolbar.offsetHeight < editorRect.top) {
      // Position below the image instead
      imageEditingToolbar.style.top = (imgRect.bottom + window.scrollY + 10) + 'px';
    }
    
    imageEditingToolbar.style.display = 'block';
  }
  
  // Populate the toolbar with the image's current properties
  function populateImageToolbar(img) {
    // Determine current size category
    let sizeValue = 'medium'; // Default
    if (img.width <= 200) sizeValue = 'small';
    else if (img.width >= 500) sizeValue = 'large';
    else if (img.style.width.includes('%') || img.hasAttribute('width')) sizeValue = 'custom';
    
    imageSizeSelect.value = sizeValue;
    
    // Set custom size inputs if available
    if (img.width && img.height) {
      imageWidth.value = img.width;
      imageHeight.value = img.height;
    }
    
    // Show/hide custom size controls
    customSizeControls.style.display = sizeValue === 'custom' ? 'inline-flex' : 'none';
    
    // Set border properties
    if (img.style.borderColor) {
      imageBorderColor.value = rgbToHex(img.style.borderColor);
    } else {
      imageBorderColor.value = '#000000';
    }
    
    imageBorderWidth.value = parseInt(img.style.borderWidth) || 0;
    
    // Set padding
    imagePadding.value = parseInt(img.style.padding) || 0;
    
    // Set alt text
    imageAltText.value = img.alt || '';
  }
  
  // Helper function to convert RGB to HEX
  function rgbToHex(rgb) {
    // Check if it's already a hex value
    if (rgb.startsWith('#')) return rgb;
    
    // Extract RGB values
    const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\)$/);
    if (!match) return '#000000';
    
    function toHex(n) {
      const hex = Number(n).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }
    
    return '#' + toHex(match[1]) + toHex(match[2]) + toHex(match[3]);
  }
  
  // Apply the image edit based on the user's selection
  function applyImageEdit(property, value) {
    if (!selectedImage) return;
    
    switch (property) {
      case 'size':
        // Apply predefined sizes
        if (value === 'small') {
          selectedImage.style.width = '200px';
          selectedImage.removeAttribute('width');
          selectedImage.removeAttribute('height');
        } else if (value === 'medium') {
          selectedImage.style.width = '350px';
          selectedImage.removeAttribute('width');
          selectedImage.removeAttribute('height');
        } else if (value === 'large') {
          selectedImage.style.width = '500px';
          selectedImage.removeAttribute('width');
          selectedImage.removeAttribute('height');
        } else if (value === 'original') {
          selectedImage.style.width = '';
          selectedImage.removeAttribute('width');
          selectedImage.removeAttribute('height');
        }
        break;
        
      case 'align':
        // Clear existing alignment and float
        selectedImage.style.float = '';
        // Apply text alignment
        selectedImage.style.display = 'block';
        if (value === 'left') {
          selectedImage.style.marginLeft = '0';
          selectedImage.style.marginRight = 'auto';
        } else if (value === 'center') {
          selectedImage.style.marginLeft = 'auto';
          selectedImage.style.marginRight = 'auto';
        } else if (value === 'right') {
          selectedImage.style.marginLeft = 'auto';
          selectedImage.style.marginRight = '0';
        }
        break;
        
      case 'float':
        // Clear alignment margins
        selectedImage.style.marginLeft = '';
        selectedImage.style.marginRight = '';
        selectedImage.style.display = '';
        
        // Apply float
        selectedImage.style.float = value;
        if (value !== 'none') {
          selectedImage.style.margin = '0 ' + (value === 'left' ? '15px 15px 0' : '0 15px 15px');
        } else {
          selectedImage.style.float = '';
          selectedImage.style.margin = '';
        }
        break;
        
      case 'border':
        const width = imageBorderWidth.value + 'px';
        const color = imageBorderColor.value;
        if (parseInt(imageBorderWidth.value) > 0) {
          selectedImage.style.border = width + ' solid ' + color;
        } else {
          selectedImage.style.border = 'none';
        }
        break;
        
      case 'padding':
        selectedImage.style.padding = imagePadding.value + 'px';
        break;
        
      case 'alt':
        selectedImage.alt = imageAltText.value;
        break;
        
      case 'remove':
        if (confirm('Are you sure you want to remove this image?')) {
          selectedImage.parentNode.removeChild(selectedImage);
          closeImageEditingToolbar();
        }
        break;
    }
    
    // Save changes to localStorage
    autoSaveEdit();
  }
  
  // Apply custom size
  function applyCustomSize() {
    if (!selectedImage) return;
    
    const width = imageWidth.value;
    const height = imageHeight.value;
    
    if (width) {
      selectedImage.width = width;
      selectedImage.style.width = width + 'px';
    }
    
    if (height) {
      selectedImage.height = height;
      selectedImage.style.height = height + 'px';
    }
    
    // Save changes to localStorage
    autoSaveEdit();
  }
  
  // Close the image editing toolbar
  function closeImageEditingToolbar() {
    imageEditingToolbar.style.display = 'none';
  }
  
  // Handle keyboard shortcuts for formatting
  function handleKeyboardShortcuts(e) {
    if (e.ctrlKey || e.metaKey) {
      switch(e.key.toLowerCase()) {
        case 'b':
          e.preventDefault();
          formatText('bold');
          break;
        case 'i':
          e.preventDefault();
          formatText('italic');
          break;
        case 'u':
          e.preventDefault();
          formatText('underline');
          break;
        case 'z':
          e.preventDefault();
          formatText('undo');
          break;
        case 'y':
          e.preventDefault();
          formatText('redo');
          break;
      }
    }
  }
  
  // Update mobile UI based on screen size
  function updateMobileUI() {
    if (window.innerWidth <= 768) {
      // Switch to mobile layout (hide sidebar)
      sidebar.style.display = 'none';
      mainContent.style.paddingBottom = '50px';
      
      // In mobile view, hide sidebar if editorContainer is not visible
      if (editorContainer.style.display !== 'flex') {
        sidebar.style.display = 'none';
      }
    } else {
      // Switch to desktop layout (show sidebar)
      sidebar.style.display = 'block';
      mainContent.style.paddingBottom = '0';
    }
  }
  
  // Show the novel list instead of the editor
  function showNovelList() {
    if (currentNovelIndex !== -1) {
      saveCurrentChapter(); // Save current chapter before switching
      saveToIndexedDB('novels', 'novelsData', novels); // Save to IndexedDB
    }
    
    editorContainer.style.display = 'none';
    characterEditorContainer.style.display = 'none';
    novelEditorContainer.style.display = 'none';
    loreEditorContainer.style.display = 'none';
    timelineContainer.style.display = 'none';
    novelListContainer.style.display = 'flex';
    
    // Hide sidebar in mobile view when not in editor
    if (window.innerWidth <= 768) {
      sidebar.style.display = 'none';
    }
    
    updateNovelList();
  }
  
  // Show the editor instead of the novel list
  function showEditor() {
    novelListContainer.style.display = 'none';
    characterEditorContainer.style.display = 'none';
    novelEditorContainer.style.display = 'none';
    loreEditorContainer.style.display = 'none';
    timelineContainer.style.display = 'none';
    editorContainer.style.display = 'flex';
  }
  
  // Add a new novel
  function addNovel() {
    // Save current work if there is any
    if (currentNovelIndex !== -1) {
      saveCurrentChapter();
    }
    
    let newNovel = {
      title: `Untitled Novel ${novels.length + 1}`,
      author: "",
      genre: "",
      status: "Planning",
      targetAudience: "",
      wordCountGoal: 50000,
      series: "",
      seriesNumber: "",
      language: "English",
      tags: "",
      synopsis: "",
      publisher: "",
      publicationDate: "",
      isbn: "",
      copyright: "",
      notes: "",
      coverImage: null,
      chapters: [],
      characters: [],
      lore: [], // New property for lore entries
      timeline: [], // New property for timeline events
      timelineSettings: JSON.parse(JSON.stringify(timelineSettings)), // Copy default timeline settings
      currentChapterIndex: -1
    };
    
    novels.push(newNovel);
    currentNovelIndex = novels.length - 1;
    
    // Add first chapter to the new novel
    addChapter();
    
    updateNovelList();
    saveToIndexedDB('novels', 'novelsData', novels); // Save to IndexedDB
  }
  
  // Update the novel list in the UI as book displays
  function updateNovelList() {
    novelList.innerHTML = '';
    
    novels.forEach((novel, index) => {
      // Create a book element
      let bookElement = document.createElement('div');
      bookElement.className = 'book';
      
      // Create default colors based on the novel index
      const colors = [
        '#3f51b5', '#2196f3', '#009688', '#4caf50', '#ff9800', 
        '#795548', '#9c27b0', '#e91e63', '#f44336', '#673ab7'
      ];
      const color = colors[index % colors.length];
      
      // Get author display text
      const authorText = novel.author ? novel.author : "Unknown Author";
      
      // Get lore count with fallback for backward compatibility
      const loreCount = novel.lore ? novel.lore.length : 0;
      
      // Create the book HTML
      bookElement.innerHTML = `
        <div class="book-page"></div>
        <div class="book-spine"></div>
        <div class="book-cover">
          <div class="book-cover-img" style="${novel.coverImage ? `background-image:url('${novel.coverImage}');` : ''}"></div>
          <div class="book-info">
            <div>
              <span class="book-title">${novel.title}</span>
              <p class="book-author">${authorText}</p>
            </div>
            <div class="book-stats">
              ${novel.chapters.length} chapter${novel.chapters.length !== 1 ? 's' : ''} • 
              ${novel.characters ? novel.characters.length : 0} character${!novel.characters || novel.characters.length !== 1 ? 's' : ''} <br>
              ${loreCount} lore item${loreCount !== 1 ? 's' : ''}
            </div>
          </div>
          <div class="book-buttons">
            <button class="book-button edit-button" id="editNovelBtn-${index}">Edit</button>
            <button class="book-button open-button" id="openNovelBtn-${index}">Open</button>
            <button class="book-button delete-button" id="deleteNovelBtn-${index}" ${novels.length === 1 ? 'disabled title="Cannot delete the only novel"' : ''} style="${novels.length === 1 ? 'background:var(--text-light); cursor:not-allowed;' : ''}">Delete</button>
          </div>
        </div>
      `;
      
      novelList.appendChild(bookElement);
      
      // Add event listeners for the buttons
      document.getElementById(`editNovelBtn-${index}`).addEventListener('click', function() {
        editNovelDetails(index);
      });
      
      document.getElementById(`openNovelBtn-${index}`).addEventListener('click', function() {
        editNovel(index);
      });
      
      document.getElementById(`deleteNovelBtn-${index}`).addEventListener('click', function() {
        removeNovel(index);
      });
    });
  }
  
  // Preview Novel Cover
  function previewNovelCover(input) {
    const file = input.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        novelCoverData = e.target.result;
        novelCoverPreview.src = novelCoverData;
        novelCoverPreview.style.display = 'block';
        coverUploadPrompt.style.display = 'none';
        removeCoverBtn.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  }
  
  // Remove Novel Cover
  function removeNovelCover() {
    novelCoverData = null;
    novelCoverPreview.src = '';
    novelCoverPreview.style.display = 'none';
    coverUploadPrompt.style.display = 'block';
    removeCoverBtn.style.display = 'none';
    novelCoverInput.value = '';
  }
  
  // Edit Novel Details
  function editNovelDetails(index) {
    if (currentNovelIndex !== -1) {
      saveCurrentChapter(); // Save any changes to current chapter
      saveToIndexedDB('novels', 'novelsData', novels); // Save to IndexedDB
    }
    
    currentNovelIndex = index;
    const novel = novels[currentNovelIndex];
    
    // Populate form with novel data
    novelTitle.value = novel.title || '';
    novelAuthor.value = novel.author || '';
    novelGenre.value = novel.genre || '';
    novelStatus.value = novel.status || 'Planning';
    novelTargetAudience.value = novel.targetAudience || '';
    novelWordCountGoal.value = novel.wordCountGoal || '';
    novelSeries.value = novel.series || '';
    novelSeriesNumber.value = novel.seriesNumber || '';
    novelLanguage.value = novel.language || 'English';
    novelTags.value = novel.tags || '';
    novelSynopsis.value = novel.synopsis || '';
    novelPublisher.value = novel.publisher || '';
    novelPublicationDate.value = novel.publicationDate || '';
    novelISBN.value = novel.isbn || '';
    novelCopyright.value = novel.copyright || '';
    novelNotes.value = novel.notes || '';
    
    // Set cover image if available
    novelCoverData = novel.coverImage;
    if (novelCoverData) {
      novelCoverPreview.src = novelCoverData;
      novelCoverPreview.style.display = 'block';
      coverUploadPrompt.style.display = 'none';
      removeCoverBtn.style.display = 'block';
    } else {
      novelCoverPreview.style.display = 'none';
      coverUploadPrompt.style.display = 'block';
      removeCoverBtn.style.display = 'none';
    }
    
    // Show novel editor
    novelListContainer.style.display = 'none';
    editorContainer.style.display = 'none';
    characterEditorContainer.style.display = 'none';
    loreEditorContainer.style.display = 'none';
    timelineContainer.style.display = 'none';
    novelEditorContainer.style.display = 'flex';
    
    // Hide sidebar in mobile view when not in editor
    if (window.innerWidth <= 768) {
      sidebar.style.display = 'none';
    }
    
    novelEditTitle.textContent = `Edit Novel: ${novel.title}`;

  }
  
  // Close Novel Editor
  function closeNovelEditor() {
    novelEditorContainer.style.display = 'none';
    showNovelList();
  }
  
  // Save Novel Details
  function saveNovelDetails(event) {
    event.preventDefault();
    
    if (currentNovelIndex < 0) return;
    
    // Get novel data from form
    const novel = novels[currentNovelIndex];
    
    novel.title = novelTitle.value;
    novel.author = novelAuthor.value;
    novel.genre = novelGenre.value;
    novel.status = novelStatus.value;
    novel.targetAudience = novelTargetAudience.value;
    novel.wordCountGoal = novelWordCountGoal.value;
    novel.series = novelSeries.value;
    novel.seriesNumber = novelSeriesNumber.value;
    novel.language = novelLanguage.value;
    novel.tags = novelTags.value;
    novel.synopsis = novelSynopsis.value;
    novel.publisher = novelPublisher.value;
    novel.publicationDate = novelPublicationDate.value;
    novel.isbn = novelISBN.value;
    novel.copyright = novelCopyright.value;
    novel.notes = novelNotes.value;
    novel.coverImage = novelCoverData;
    
    // Update UI
    updateNovelList();
    
    // Save to IndexedDB
    saveToIndexedDB('novels', 'novelsData', novels);
    
    // Close editor and show novel list
    closeNovelEditor();
    
    // Show confirmation
    alert('Novel details saved successfully!');
  }
  
  // Rename a novel
  function renameNovel(index, newTitle) {
    if (index >= 0 && index < novels.length) {
      novels[index].title = newTitle;
      updateNovelList();
      saveToIndexedDB('novels', 'novelsData', novels); // Save to IndexedDB
    }
  }
  
  // Edit a novel
  function editNovel(index) {
    if (currentNovelIndex !== -1) {
      saveCurrentChapter(); // Save any changes to current chapter
      saveToIndexedDB('novels', 'novelsData', novels); // Save to IndexedDB
    }
    
    currentNovelIndex = index;
    updateChapterList();
    updateCharacterList();
    updateLoreList();
    
    // Load the first chapter or create one if none exists
    if (novels[currentNovelIndex].chapters.length > 0) {
      loadChapter(novels[currentNovelIndex].currentChapterIndex >= 0 ? 
                 novels[currentNovelIndex].currentChapterIndex : 0);
    } else {
      addChapter();
    }
    
    showEditor();
  }
  
  // Remove a novel
  async function removeNovel(index) {
    // Prevent deletion if there's only one novel
    if (novels.length === 1) {
      return;
    }
    
    if (confirm('Are you sure you want to delete this novel? This action cannot be undone.')) {
      novels.splice(index, 1);
      
      if (novels.length === 0) {
        // Add a new novel if all were deleted
        addNovel();
      } else if (currentNovelIndex === index) {
        // If the current novel was deleted, select another one
        currentNovelIndex = Math.min(index, novels.length - 1);
        updateChapterList();
        updateCharacterList();
        updateLoreList();
        loadChapter(novels[currentNovelIndex].currentChapterIndex >= 0 ? 
                   novels[currentNovelIndex].currentChapterIndex : 0);
      } else if (currentNovelIndex > index) {
        // Adjust current novel index if a novel before it was deleted
        currentNovelIndex--;
      }
      
      updateNovelList();
      await saveToIndexedDB('novels', 'novelsData', novels); // Save to IndexedDB
    }
  }
  
  // Add a new chapter to the current novel
  function addChapter() {
    if (currentNovelIndex < 0) return;
    
    let novel = novels[currentNovelIndex];
    let newChapter = {
      title: `Chapter ${novel.chapters.length + 1}`,
      content: "",
      summary: "" // Initialize with empty summary
    };
    
    novel.chapters.push(newChapter);
    novel.currentChapterIndex = novel.chapters.length - 1;
    updateChapterList();
    loadChapter(novel.currentChapterIndex);
    
    saveToIndexedDB('novels', 'novelsData', novels); // Save to IndexedDB
  }
  
  // Function to handle edit button click
  function editChapterTitle(event, index) {
    event.stopPropagation(); // Prevent chapter selection
    const titleElement = event.target.parentElement.querySelector('.chapter-title');
    makeChapterTitleEditable(titleElement, index);
  }
  
  // Open the summary modal for a specific chapter
  function openSummaryModal(chapterIndex) {
    event.stopPropagation(); // Prevent chapter selection
    summaryChapterIndex = chapterIndex;
    const chapter = novels[currentNovelIndex].chapters[chapterIndex];
    
    // Set the modal title
    summaryModalTitle.textContent = `Summary: ${chapter.title}`;
    
    // Set the current summary if it exists
    summaryTextarea.value = chapter.summary || '';
    
    // Show the modal
    summaryModal.style.display = 'flex';
  }
  
  // Close the summary modal
  function closeSummaryModal() {
    summaryModal.style.display = 'none';
    summaryChapterIndex = -1;
  }
  
  // Save the chapter summary
  async function saveChapterSummary() {
    if (summaryChapterIndex < 0 || currentNovelIndex < 0) return;
    
    // Get the summary text
    const summaryText = summaryTextarea.value;
    
    // Save to the chapter
    novels[currentNovelIndex].chapters[summaryChapterIndex].summary = summaryText;
    
    // Save to IndexedDB
    await saveToIndexedDB('novels', 'novelsData', novels);
    
    // Close the modal
    closeSummaryModal();
    
    // Update chapter list to show summary indicator if needed
    updateChapterList();
  }
  
  // Generate a summary using AI
  async function generateChapterSummary() {
    if (summaryChapterIndex < 0 || currentNovelIndex < 0) return;
    
    // Get the chapter content
    const chapter = novels[currentNovelIndex].chapters[summaryChapterIndex];
    
    // Disable button and show loading state
    generateSummaryBtn.disabled = true;
    generateSummaryBtn.textContent = "⏳ Generating...";
    
    try {
      // Extract text content from HTML to avoid all the HTML tags in the prompt
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = chapter.content;
      const textContent = tempDiv.textContent || tempDiv.innerText;
      
      // Call the AI to generate a summary
      const summary = await useAI(false, { 
        mode: 'summary',
        chapterContent: textContent,
      });
      
      // Set the generated summary in the textarea
      summaryTextarea.value = summary;
    } catch (error) {
      console.error('Error generating summary:', error);
      alert('An error occurred while generating the summary. Please try again.');
    } finally {
      // Re-enable the button
      generateSummaryBtn.disabled = false;
      generateSummaryBtn.textContent = "Generate with AI";
    }
  }
  
  // Drag and drop handlers for reordering
  function handleDragStart(e) {
    draggedItem = this;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.index);
    this.classList.add('dragging');
  }
  
  function handleDragOver(e) {
    if (!draggedItem) return;
    
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    
    // Check if we're dragging over an item of the same type
    if (draggedItem.dataset.type === this.dataset.type) {
      const rect = this.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      
      // Add visual indicator for drop position
      if (e.clientY < midY) {
        this.classList.add('drop-above');
        this.classList.remove('drop-below');
      } else {
        this.classList.add('drop-below');
        this.classList.remove('drop-above');
      }
    }
  }
  
  function handleDragLeave() {
    this.classList.remove('drop-above', 'drop-below');
  }
  
  function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // Remove drop indicators
    this.classList.remove('drop-above', 'drop-below');
    
    // Only handle drops if items are of the same type
    if (!draggedItem || draggedItem.dataset.type !== this.dataset.type) return;
    
    const fromIndex = parseInt(draggedItem.dataset.index);
    const toIndex = parseInt(this.dataset.index);
    
    // Don't do anything if dropping onto itself
    if (fromIndex === toIndex) return;
    
    const rect = this.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const insertAfter = e.clientY > midY;
    
    // Calculate where to insert the item
    let insertIndex = toIndex;
    if (insertAfter) {
        insertIndex++;
    }
    // Adjust for the item removal if necessary
    if (fromIndex < insertIndex) {
        insertIndex--;
    }
    
    // Perform the reordering based on the item type
    if (draggedItem.dataset.type === 'chapter') {
        reorderChapters(fromIndex, insertIndex);
    } else if (draggedItem.dataset.type === 'character') {
        reorderCharacters(fromIndex, insertIndex);
    } else if (draggedItem.dataset.type === 'lore') {
        reorderLoreEntries(fromIndex, insertIndex);
    }
  }
  
  function handleDragEnd() {
    this.classList.remove('dragging');
    document.querySelectorAll('.drop-above, .drop-below').forEach(el => {
      el.classList.remove('drop-above', 'drop-below');
    });
    draggedItem = null;
  }
  
  // Reorder chapters
  async function reorderChapters(fromIndex, toIndex) {
    if (currentNovelIndex < 0 || !novels[currentNovelIndex].chapters) return;
    
    const chapters = novels[currentNovelIndex].chapters;
    
    // Make sure indices are valid
    if (fromIndex < 0 || fromIndex >= chapters.length || toIndex < 0 || toIndex > chapters.length) return;
    
    // Get the chapter to move
    const chapter = chapters[fromIndex];
    
    // Remove the chapter from its original position
    chapters.splice(fromIndex, 1);
    
    // Insert it at the new position
    chapters.splice(toIndex, 0, chapter);
    
    // If the current chapter was moved, update the current index
    if (novels[currentNovelIndex].currentChapterIndex === fromIndex) {
        novels[currentNovelIndex].currentChapterIndex = toIndex;
    } else if (novels[currentNovelIndex].currentChapterIndex > fromIndex && 
              novels[currentNovelIndex].currentChapterIndex <= toIndex) {
        novels[currentNovelIndex].currentChapterIndex--;
    } else if (novels[currentNovelIndex].currentChapterIndex < fromIndex && 
              novels[currentNovelIndex].currentChapterIndex >= toIndex) {
        novels[currentNovelIndex].currentChapterIndex++;
    }
    
    // Update UI and save
    updateChapterList();
    await saveToIndexedDB('novels', 'novelsData', novels);
  }
  
  // Reorder characters
  async function reorderCharacters(fromIndex, toIndex) {
    if (currentNovelIndex < 0 || !novels[currentNovelIndex].characters) return;
    
    const characters = novels[currentNovelIndex].characters;
    
    // Make sure indices are valid
    if (fromIndex < 0 || fromIndex >= characters.length || toIndex < 0 || toIndex > characters.length) return;
    
    // Get the character to move
    const character = characters[fromIndex];
    
    // Remove the character from its original position
    characters.splice(fromIndex, 1);
    
    // Insert it at the new position
    characters.splice(toIndex, 0, character);
    
    // Update UI and save
    updateCharacterList();
    await saveToIndexedDB('novels', 'novelsData', novels);
  }
  
  // Reorder lore entries
  async function reorderLoreEntries(fromIndex, toIndex) {
    if (currentNovelIndex < 0 || !novels[currentNovelIndex].lore) return;
    
    const lore = novels[currentNovelIndex].lore;
    
    // Make sure indices are valid
    if (fromIndex < 0 || fromIndex >= lore.length || toIndex < 0 || toIndex > lore.length) return;
    
    // Get the lore entry to move
    const loreEntry = lore[fromIndex];
    
    // Remove the lore entry from its original position
    lore.splice(fromIndex, 1);
    
    // Insert it at the new position
    lore.splice(toIndex, 0, loreEntry);
    
    // Update UI and save
    updateLoreList();
    await saveToIndexedDB('novels', 'novelsData', novels);
  }
  
  // Update the chapter list in the sidebar with editable titles
  function updateChapterList() {
    chapterList.innerHTML = '';
    
    if (currentNovelIndex < 0 || currentNovelIndex >= novels.length) return;
    
    let novel = novels[currentNovelIndex];
    
    novel.chapters.forEach((chapter, index) => {
      let li = document.createElement('li');
      li.className = 'chapter-item' + (index === novel.currentChapterIndex ? ' active' : '');
      li.draggable = true;
      li.dataset.index = index;
      li.dataset.type = 'chapter';
      
      li.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; flex:1;">
            <span class="drag-handle">☰</span>
            <span class="chapter-title" data-index="${index}" style="cursor:text;">${chapter.title}</span>
          </div>
          <div>
            <button class="chapter-summary-btn" data-index="${index}" style="background:none; border:none; color:var(--secondary); cursor:pointer; font-size:12px; margin-right:5px;">📝</button>
            <button class="chapter-delete-btn" data-index="${index}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:12px;">×</button>
          </div>
        </div>
      `;
      
      // Add event listeners for drag and drop
      li.addEventListener('dragstart', handleDragStart);
      li.addEventListener('dragover', handleDragOver);
      li.addEventListener('dragleave', handleDragLeave);
      li.addEventListener('drop', handleDrop);
      li.addEventListener('dragend', handleDragEnd);
      
      // Add click handler for the list item
      li.onclick = (e) => {
        // Don't trigger for buttons or when editing title or during drag
        if (e.target.tagName !== 'BUTTON' && !e.target.isContentEditable && !draggedItem) {
          saveCurrentChapter();
          saveToIndexedDB('novels', 'novelsData', novels); // Save to IndexedDB
          loadChapter(index);
          showEditor();
        }
      };
      
      chapterList.appendChild(li);
      
      // Add double-click handler for the chapter title to make it editable
      let titleSpan = li.querySelector('.chapter-title');
      titleSpan.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        makeChapterTitleEditable(titleSpan, index);
      });
      
      // Add click handler for direct editing of chapter title
      titleSpan.addEventListener('click', (e) => {
        e.stopPropagation();
        makeChapterTitleEditable(titleSpan, index);
      });
      
      // Add click handlers for summary and delete buttons
      li.querySelector('.chapter-summary-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openSummaryModal(parseInt(e.target.dataset.index));
      });
      
      li.querySelector('.chapter-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeChapter(parseInt(e.target.dataset.index));
      });
    });
  }
  
  // Make a chapter title editable
  function makeChapterTitleEditable(titleElement, chapterIndex) {
    // Set the element to be editable
    titleElement.contentEditable = true;
    titleElement.focus();
    
    // Add visual styling to indicate it's editable
    titleElement.style.backgroundColor = "var(--input-bg)";
    titleElement.style.padding = "2px 5px";
    titleElement.style.border = "1px solid var(--input-border)";
    titleElement.style.borderRadius = "3px";
    
    // Select all text
    document.execCommand('selectAll', false, null);
    
    // Add event listeners to save when done editing
    titleElement.onblur = () => {
      saveChapterTitle(titleElement, chapterIndex);
    };
    
    titleElement.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleElement.blur();
      } else if (e.key === 'Escape') {
        titleElement.textContent = novels[currentNovelIndex].chapters[chapterIndex].title;
        titleElement.contentEditable = false;
        resetTitleElementStyle(titleElement);
      }
    };
  }
  
  // Reset title element style after editing
  function resetTitleElementStyle(titleElement) {
    titleElement.style.backgroundColor = "";
    titleElement.style.padding = "";
    titleElement.style.border = "";
    titleElement.style.borderRadius = "";
  }
  
  // Save a chapter title after editing
  async function saveChapterTitle(titleElement, chapterIndex) {
    titleElement.contentEditable = false;
    resetTitleElementStyle(titleElement);
    
    if (titleElement.textContent.trim() === '') {
      titleElement.textContent = novels[currentNovelIndex].chapters[chapterIndex].title;
    } else {
      novels[currentNovelIndex].chapters[chapterIndex].title = titleElement.textContent;
      await saveToIndexedDB('novels', 'novelsData', novels); // Save to IndexedDB
    }
  }
  
  // Load chapter content into editor
  function loadChapter(index) {
    if (currentNovelIndex < 0) return;
    let novel = novels[currentNovelIndex];
    
    if (index < 0 || index >= novel.chapters.length) return;
    
    novel.currentChapterIndex = index;
    let chapter = novel.chapters[index];
    
    editor.innerHTML = chapter.content;
    
    updateChapterList();
    updateWordCount();
  }
  
  // Save current chapter content
  function saveCurrentChapter() {
    if (currentNovelIndex < 0) return;
    let novel = novels[currentNovelIndex];
    
    if (novel.currentChapterIndex < 0) return;
    
    novel.chapters[novel.currentChapterIndex].content = editor.innerHTML;
  }
  
  // Remove a chapter from the current novel
  async function removeChapter(index) {
    if (currentNovelIndex < 0) return;
    let novel = novels[currentNovelIndex];
    
    if (confirm('Are you sure you want to delete this chapter?')) {
      novel.chapters.splice(index, 1);
      
      if (novel.currentChapterIndex === index) {
        novel.currentChapterIndex = Math.min(index, novel.chapters.length - 1);
      } else if (novel.currentChapterIndex > index) {
        novel.currentChapterIndex--;
      }
      
      updateChapterList();
      
      if (novel.chapters.length === 0) {
        addChapter();
      } else {
        loadChapter(novel.currentChapterIndex);
      }
      
      await saveToIndexedDB('novels', 'novelsData', novels); // Save to IndexedDB
    }
  }

  // Add a new character image
  function addCharacterImage() {
    // Create a new empty image slot
    const imageIndex = characterImagesData.length;
    characterImagesData.push(null); // Add empty placeholder in array
    
    // Add empty image to UI
    addImageToUI(imageIndex, null);
    
    // Set as current and open file dialog
    currentImageIndex = imageIndex;
    document.getElementById('charImageInput').click();
  }

  // Add image to the UI
  function addImageToUI(index, imageData) {
    const imageContainer = document.createElement('div');
    imageContainer.className = 'character-image-item';
    imageContainer.dataset.index = index;
    
    if (imageData) {
      // If there's image data, show the image
      const img = document.createElement('img');
      img.src = imageData;
      img.style.cssText = 'max-width:100%; max-height:100%; object-fit:cover;';
      img.onclick = (e) => openImagePreview(e, imageData);
      imageContainer.appendChild(img);
      
      // Add remove button
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.style.cssText = 'position:absolute; top:0; right:0; background:rgba(244,67,54,0.8); color:white; border:none; width:24px; height:24px; border-radius:50%; cursor:pointer;';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeCharacterImage(index);
      };
      imageContainer.appendChild(removeBtn);
    } else {
      // Empty slot
      const placeholderText = document.createElement('span');
      placeholderText.textContent = 'Click to add';
      placeholderText.style.color = 'var(--text-light)';
      imageContainer.appendChild(placeholderText);
      
      // Make the container clickable to add an image
      imageContainer.style.cursor = 'pointer';
      imageContainer.onclick = () => {
        currentImageIndex = index;
        document.getElementById('charImageInput').click();
      };
    }
    
    charImagesContainer.appendChild(imageContainer);
  }

  // Preview the character image when selected
  function previewCharacterImage(input) {
    const file = input.files[0];
    if (file && currentImageIndex >= 0) {
      const reader = new FileReader();
      reader.onload = function(e) {
        // Save the image data at the current index
        characterImagesData[currentImageIndex] = e.target.result;
        
        // Update UI - refresh the images container
        refreshImagesContainer();
      };
      reader.readAsDataURL(file);
    }
  }

  // Remove a character image
  function removeCharacterImage(index) {
    if (index === undefined) {
      // If no index provided, remove all images
      characterImagesData = [];
    } else {
      // Remove specific image
      characterImagesData.splice(index, 1);
    }
    
    // Refresh the images container
    refreshImagesContainer();
  }

  // Refresh the images container to reflect the current state
  function refreshImagesContainer() {
    // Clear the container
    charImagesContainer.innerHTML = '';
    
    // Add existing images
    characterImagesData.forEach((imageData, index) => {
      if (imageData) {
        addImageToUI(index, imageData);
      }
    });
    
    // Add an empty slot if there are no images or all slots have images
    if (characterImagesData.length === 0 || !characterImagesData.includes(null)) {
      addImageToUI(characterImagesData.length, null);
    }
  }

  // Open full-size image preview when clicking on the thumbnail
  function openImagePreview(event, imageData) {
    event.stopPropagation(); // Prevent triggering the container click
    
    if (!imageData) return;
    
    fullSizeCharacterImage.src = imageData;
    characterImagePreviewModal.style.display = 'flex';
  }

  // Close the image preview modal
  function closeImagePreviewModal() {
    characterImagePreviewModal.style.display = 'none';
  }
  
  // Character management functions
  // Add a new character to the current novel
  function addCharacter() {
    if (currentNovelIndex < 0) return;
    
    // Initialize characters array if it doesn't exist
    if (!novels[currentNovelIndex].characters) {
      novels[currentNovelIndex].characters = [];
    }
    
    // Clear the character form for a new character
    clearCharacterForm();
    
    // Set the current character index to -1 to indicate a new character
    currentCharacterIndex = -1;
    characterImagesData = []; // Initialize with empty array
    
    // Initialize the images container
    refreshImagesContainer();
    
    // Hide the novel list and editor containers when showing character editor
    novelListContainer.style.display = 'none';
    editorContainer.style.display = 'none';
    loreEditorContainer.style.display = 'none';
    timelineContainer.style.display = 'none';
    
    // Show the character editor
    novelEditorContainer.style.display = 'none';
    characterEditorContainer.style.display = 'flex';
    
    // Hide sidebar in mobile view when not in editor
    if (window.innerWidth <= 768) {
      sidebar.style.display = 'none';
    }
    
    characterEditTitle.textContent = 'New Character';

  }
  
  // Save the character from the form
  async function saveCharacter(event) {
    event.preventDefault();
    
    if (currentNovelIndex < 0) return;
    
    // Get the character data from the form
    const character = {
      name: charName.value,
      role: charRole.value,
      age: charAge.value,
      gender: charGender.value,
      occupation: charOccupation.value,
      images: characterImagesData.filter(img => img !== null), // Save array of image data, filtering out null values
      appearance: {
        height: charHeight.value,
        build: charBuild.value,
        hair: charHair.value,
        eyes: charEyes.value,
        skin: charSkin.value,
        clothing: charFeatures.value
      },
      personality: charPersonality.value,
      backstory: charBackstory.value,
      motivation: charMotivation.value,
      flaws: charFlaws.value,
      strengths: charStrengths.value,
      relationships: charRelationships.value,
      notes: charNotes.value
    };
    
    // Initialize characters array if it doesn't exist
    if (!novels[currentNovelIndex].characters) {
      novels[currentNovelIndex].characters = [];
    }
    
    if (currentCharacterIndex === -1) {
      // Add new character
      novels[currentNovelIndex].characters.push(character);
    } else {
      // Update existing character
      novels[currentNovelIndex].characters[currentCharacterIndex] = character;
    }
    
    // Update the character list
    updateCharacterList();
    
    // Save to IndexedDB
    await saveToIndexedDB('novels', 'novelsData', novels);
    
    // Close the character editor
    closeCharacterEditor();
    
    // Show a confirmation
    alert(`Character "${character.name}" has been saved!`);
  }
  
  // Edit a character
  function editCharacter(index) {
    if (currentNovelIndex < 0 || !novels[currentNovelIndex].characters) return;
    
    currentCharacterIndex = index;
    const character = novels[currentNovelIndex].characters[index];
    
    // Populate the form with character data
    charName.value = character.name || '';
    charRole.value = character.role || 'Supporting Character';
    charAge.value = character.age || '';
    charGender.value = character.gender || '';
    charOccupation.value = character.occupation || '';
    
    // Handle character images - check for both legacy single image and new array of images
    if (character.images) {
      // New format - array of images
      characterImagesData = [...character.images];
    } else if (character.image) {
      // Legacy format - single image
      characterImagesData = character.image ? [character.image] : [];
    } else {
      characterImagesData = [];
    }
    
    // Refresh the images container
    refreshImagesContainer();
    
    // Appearance
    if (character.appearance) {
      charHeight.value = character.appearance.height || '';
      charBuild.value = character.appearance.build || '';
      charHair.value = character.appearance.hair || '';
      charEyes.value = character.appearance.eyes || '';
      charSkin.value = character.appearance.skin || '';
      charFeatures.value = character.appearance.clothing || '';
    } else {
      charHeight.value = '';
      charBuild.value = '';
      charHair.value = '';
      charEyes.value = '';
      charSkin.value = '';
      charFeatures.value = '';
    }
    
    charPersonality.value = character.personality || '';
    charBackstory.value = character.backstory || '';
    charMotivation.value = character.motivation || '';
    charFlaws.value = character.flaws || '';
    charStrengths.value = character.strengths || '';
    charRelationships.value = character.relationships || '';
    charNotes.value = character.notes || '';
    
    // Hide the novel list and editor containers when showing character editor
    novelListContainer.style.display = 'none';
    editorContainer.style.display = 'none';
    loreEditorContainer.style.display = 'none';
    timelineContainer.style.display = 'none';
    
    // Show the character editor
    novelEditorContainer.style.display = 'none';
    characterEditorContainer.style.display = 'flex';
    
    // Hide sidebar in mobile view when not in editor
    if (window.innerWidth <= 768) {
      sidebar.style.display = 'none';
    }
    
    characterEditTitle.textContent = `Edit Character: ${character.name}`;

  }
  
  // Clear the character form
  function clearCharacterForm() {
    characterForm.reset();
    charName.value = '';
    charRole.value = 'Supporting Character';
    charAge.value = '';
    charGender.value = '';
    charOccupation.value = '';
    charHeight.value = '';
    charBuild.value = '';
    charHair.value = '';
    charEyes.value = '';
    charSkin.value = '';
    charFeatures.value = '';
    charPersonality.value = '';
    charBackstory.value = '';
    charMotivation.value = '';
    charFlaws.value = '';
    charStrengths.value = '';
    charRelationships.value = '';
    charNotes.value = '';
    
    // Clear images
    characterImagesData = [];
    refreshImagesContainer();
  }
  
  // Close the character editor
  function closeCharacterEditor() {
    characterEditorContainer.style.display = 'none';
    editorContainer.style.display = 'flex';
  }
  
  // Update the character list in the sidebar
  function updateCharacterList() {
    characterList.innerHTML = '';
    
    if (currentNovelIndex < 0 || currentNovelIndex >= novels.length) return;
    
    // Initialize characters array if it doesn't exist
    if (!novels[currentNovelIndex].characters) {
      novels[currentNovelIndex].characters = [];
    }
    
    let novel = novels[currentNovelIndex];
    
    novel.characters.forEach((character, index) => {
      let li = document.createElement('li');
      li.className = 'character-item';
      li.draggable = true;
      li.dataset.index = index;
      li.dataset.type = 'character';
      
      // Check for both new (images array) and legacy (single image) formats
      const hasImages = character.images && character.images.length > 0;
      const hasLegacyImage = character.image ? true : false;
      const primaryImage = hasImages ? character.images[0] : (hasLegacyImage ? character.image : null);
      const totalImages = hasImages ? character.images.length : (hasLegacyImage ? 1 : 0);
      
      li.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="display:flex; align-items:flex-start; flex:1;">
            <span class="drag-handle">☰</span>
            <div style="display:flex; flex-direction:column;">
              <span class="character-title" style="width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${character.name}</span>
              <span style="font-size:0.8em; color:var(--text-light); min-width: 130px !important; width: 130px !important; max-width: 130px !important;">${character.role || 'Character'}</span>
            </div>
          </div>
          <div>
            <button class="character-edit-btn" data-index="${index}" style="background:none; border:none; cursor:pointer; color:var(--secondary); font-size:12px; margin-right:5px;">✏️</button>
            <button class="character-delete-btn" data-index="${index}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:12px;">×</button>
          </div>
        </div>
      `;
      
      // Add event listeners for drag and drop
      li.addEventListener('dragstart', handleDragStart);
      li.addEventListener('dragover', handleDragOver);
      li.addEventListener('dragleave', handleDragLeave);
      li.addEventListener('drop', handleDrop);
      li.addEventListener('dragend', handleDragEnd);
      
      characterList.appendChild(li);
      
      // Add click handler to edit when clicking on character name
      li.querySelector('.character-title').addEventListener('click', function(e) {
        e.stopPropagation();
        editCharacter(index);
      });
      
      // Add click handlers for edit and delete buttons
      li.querySelector('.character-edit-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        editCharacter(parseInt(e.target.dataset.index));
      });
      
      li.querySelector('.character-delete-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        removeCharacter(parseInt(e.target.dataset.index));
      });
    });
  }
  
  // Remove a character
  async function removeCharacter(index) {
    if (currentNovelIndex < 0 || !novels[currentNovelIndex].characters) return;
    
    const character = novels[currentNovelIndex].characters[index];
    
    if (confirm(`Are you sure you want to delete the character "${character.name}"?`)) {
      novels[currentNovelIndex].characters.splice(index, 1);
      updateCharacterList();
      await saveToIndexedDB('novels', 'novelsData', novels); // Save to IndexedDB
    }
  }
  
  // Lore management functions
  // Add a new lore entry to the current novel
  function addLore() {
    if (currentNovelIndex < 0) return;
    
    // Initialize lore array if it doesn't exist
    if (!novels[currentNovelIndex].lore) {
      novels[currentNovelIndex].lore = [];
    }
    
    // Clear the lore form for a new entry
    clearLoreForm();
    
    // Set the current lore index to -1 to indicate a new entry
    currentLoreIndex = -1;
    loreImagesData = []; // Initialize with empty array
    
    // Initialize the images container
    refreshLoreImagesContainer();
    
    // Hide category-specific fields initially
    hideAllCategoryFields();
    
    // Hide the novel list and editor containers when showing lore editor
    novelListContainer.style.display = 'none';
    editorContainer.style.display = 'none';
    characterEditorContainer.style.display = 'none';
    timelineContainer.style.display = 'none';
    
    // Show the lore editor
    novelEditorContainer.style.display = 'none';
    loreEditorContainer.style.display = 'flex';
    
    // Hide sidebar in mobile view when not in editor
    if (window.innerWidth <= 768) {
      sidebar.style.display = 'none';
    }
    
    loreEditTitle.textContent = 'New Lore Entry';

  }
  
  // Toggle category-specific fields based on selection
  function toggleLoreCategoryFields() {
    // Hide all category-specific fields first
    hideAllCategoryFields();
    
    // Show fields specific to the selected category
    const category = loreCategory.value;
    
    if (category === 'Location') {
      document.getElementById('locationFields').style.display = 'block';
    } else if (category === 'Item') {
      document.getElementById('itemFields').style.display = 'block';
    } else if (category === 'Creature') {
      document.getElementById('creatureFields').style.display = 'block';
    } else if (category === 'Organization') {
      document.getElementById('organizationFields').style.display = 'block';
    } else if (category === 'Event') {
      document.getElementById('eventFields').style.display = 'block';
    }
  }
  
  // Hide all category-specific fields
  function hideAllCategoryFields() {
    document.querySelectorAll('.category-fields').forEach(field => {
      field.style.display = 'none';
    });
  }
  
  // Clear the lore form
  function clearLoreForm() {
    loreForm.reset();
    loreName.value = '';
    loreCategory.value = '';
    loreCustomCategory.value = '';
    loreDescription.value = '';
    loreNotes.value = '';
    
    // Clear category-specific fields
    // Location
    locationType.value = 'City';
    locationClimate.value = '';
    locationPopulation.value = '';
    locationGovernment.value = '';
    locationHistory.value = '';
    locationCulture.value = '';
    locationEconomy.value = '';
    locationNotableFeatures.value = '';
    
    // Item
    itemType.value = 'Weapon';
    itemCreator.value = '';
    itemAge.value = '';
    itemAppearance.value = '';
    itemMaterials.value = '';
    itemPowers.value = '';
    itemHistory.value = '';
    itemOwnership.value = '';
    itemValue.value = '';
    
    // Creature
    creatureType.value = '';
    creatureHabitat.value = '';
    creatureAppearance.value = '';
    creatureAbilities.value = '';
    creatureBehavior.value = '';
    creatureDiet.value = '';
    creatureLifecycle.value = '';
    creatureSociety.value = '';
    creatureHistory.value = '';
    creatureWeaknesses.value = '';
    
    // Organization
    orgType.value = 'Government';
    orgLeadership.value = '';
    orgHeadquarters.value = '';
    orgStructure.value = '';
    orgGoals.value = '';
    orgMethods.value = '';
    orgResources.value = '';
    orgHistory.value = '';
    orgAllies.value = '';
    orgEnemies.value = '';
    
    // Event
    eventType.value = 'Battle';
    eventDate.value = '';
    eventLocation.value = '';
    eventParticipants.value = '';
    eventCauses.value = '';
    eventOutcome.value = '';
    eventConsequences.value = '';
    eventCulturalImpact.value = '';
    eventCommemoration.value = '';
    
    // Custom category
    customCategoryContainer.style.display = 'none';
    
    // Show appropriate category fields
    toggleLoreCategoryFields();
    
    // Clear images
    loreImagesData = [];
    refreshLoreImagesContainer();
  }
  
  // Add a new lore image
  function addLoreImage() {
    // Create a new empty image slot
    const imageIndex = loreImagesData.length;
    loreImagesData.push(null); // Add empty placeholder in array
    
    // Add empty image to UI
    addLoreImageToUI(imageIndex, null);
    
    // Set as current and open file dialog
    currentImageIndex = imageIndex;
    document.getElementById('loreImageInput').click();
  }
  
  // Add lore image to the UI
  function addLoreImageToUI(index, imageData) {
    const imageContainer = document.createElement('div');
    imageContainer.className = 'lore-image-item';
    imageContainer.dataset.index = index;
    
    if (imageData) {
      // If there's image data, show the image
      const img = document.createElement('img');
      img.src = imageData;
      img.style.cssText = 'max-width:100%; max-height:100%; object-fit:cover;';
      img.onclick = (e) => openLoreImagePreview(e, imageData);
      imageContainer.appendChild(img);
      
      // Add remove button
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.style.cssText = 'position:absolute; top:0; right:0; background:rgba(244,67,54,0.8); color:white; border:none; width:24px; height:24px; border-radius:50%; cursor:pointer;';
      removeBtn.onclick = (e) => {
        e.stopPropagation();
        removeLoreImage(index);
      };
      imageContainer.appendChild(removeBtn);
    } else {
      // Empty slot
      const placeholderText = document.createElement('span');
      placeholderText.textContent = 'Click to add';
      placeholderText.style.color = 'var(--text-light)';
      imageContainer.appendChild(placeholderText);
      
      // Make the container clickable to add an image
      imageContainer.style.cursor = 'pointer';
      imageContainer.onclick = () => {
        currentImageIndex = index;
        document.getElementById('loreImageInput').click();
      };
    }
    
    loreImagesContainer.appendChild(imageContainer);
  }
  
  // Preview the lore image when selected
  function previewLoreImage(input) {
    const file = input.files[0];
    if (file && currentImageIndex >= 0) {
      const reader = new FileReader();
      reader.onload = function(e) {
        // Save the image data at the current index
        loreImagesData[currentImageIndex] = e.target.result;
        
        // Update UI - refresh the images container
        refreshLoreImagesContainer();
      };
      reader.readAsDataURL(file);
    }
  }
  
  // Remove a lore image
  function removeLoreImage(index) {
    if (index === undefined) {
      // If no index provided, remove all images
      loreImagesData = [];
    } else {
      // Remove specific image
      loreImagesData.splice(index, 1);
    }
    
    // Refresh the images container
    refreshLoreImagesContainer();
  }
  
  // Refresh the lore images container to reflect the current state
  function refreshLoreImagesContainer() {
    // Clear the container
    loreImagesContainer.innerHTML = '';
    
    // Add existing images
    loreImagesData.forEach((imageData, index) => {
      if (imageData) {
        addLoreImageToUI(index, imageData);
      }
    });
    
    // Add an empty slot if there are no images or all slots have images
    if (loreImagesData.length === 0 || !loreImagesData.includes(null)) {
      addLoreImageToUI(loreImagesData.length, null);
    }
  }
  
  // Open full-size lore image preview when clicking on the thumbnail
  function openLoreImagePreview(event, imageData) {
    event.stopPropagation(); // Prevent triggering the container click
    
    if (!imageData) return;
    
    fullSizeLoreImage.src = imageData;
    loreImagePreviewModal.style.display = 'flex';
  }
  
  // Close the lore image preview modal
  function closeLoreImagePreviewModal() {
    loreImagePreviewModal.style.display = 'none';
  }
  
  // Save the lore entry from the form
  async function saveLore(event) {
    event.preventDefault();
    
    if (currentNovelIndex < 0) return;
    
    // Initialize lore array if it doesn't exist
    if (!novels[currentNovelIndex].lore) {
      novels[currentNovelIndex].lore = [];
    }
    
    // Get general lore data
    const loreData = {
      name: loreName.value,
      category: loreCategory.value,
      customCategory: loreCategory.value === 'Custom' ? loreCustomCategory.value : '',
      description: loreDescription.value,
      notes: loreNotes.value,
      images: loreImagesData.filter(img => img !== null) // Save array of image data, filtering out null values
    };
    
    // Add category-specific data
    if (loreCategory.value === 'Location') {
      loreData.locationDetails = {
        type: locationType.value,
        climate: locationClimate.value,
        population: locationPopulation.value,
        government: locationGovernment.value,
        history: locationHistory.value,
        culture: locationCulture.value,
        economy: locationEconomy.value,
        notableFeatures: locationNotableFeatures.value
      };
    } else if (loreCategory.value === 'Item') {
      loreData.itemDetails = {
        type: itemType.value,
        creator: itemCreator.value,
        age: itemAge.value,
        appearance: itemAppearance.value,
        materials: itemMaterials.value,
        powers: itemPowers.value,
        history: itemHistory.value,
        ownership: itemOwnership.value,
        value: itemValue.value
      };
    } else if (loreCategory.value === 'Creature') {
      loreData.creatureDetails = {
        type: creatureType.value,
        habitat: creatureHabitat.value,
        appearance: creatureAppearance.value,
        abilities: creatureAbilities.value,
        behavior: creatureBehavior.value,
        diet: creatureDiet.value,
        lifecycle: creatureLifecycle.value,
        society: creatureSociety.value,
        history: creatureHistory.value,
        weaknesses: creatureWeaknesses.value
      };
    } else if (loreCategory.value === 'Organization') {
      loreData.organizationDetails = {
        type: orgType.value,
        leadership: orgLeadership.value,
        headquarters: orgHeadquarters.value,
        structure: orgStructure.value,
        goals: orgGoals.value,
        methods: orgMethods.value,
        resources: orgResources.value,
        history: orgHistory.value,
        allies: orgAllies.value,
        enemies: orgEnemies.value
      };
    } else if (loreCategory.value === 'Event') {
      loreData.eventDetails = {
        type: eventType.value,
        date: eventDate.value,
        location: eventLocation.value,
        participants: eventParticipants.value,
        causes: eventCauses.value,
        outcome: eventOutcome.value,
        consequences: eventConsequences.value,
        culturalImpact: eventCulturalImpact.value,
        commemoration: eventCommemoration.value
      };
    }
    
    if (currentLoreIndex === -1) {
      // Add new lore entry
      novels[currentNovelIndex].lore.push(loreData);
    } else {
      // Update existing lore entry
      novels[currentNovelIndex].lore[currentLoreIndex] = loreData;
    }
    
    // Update the lore list
    updateLoreList();
    
    // Save to IndexedDB
    await saveToIndexedDB('novels', 'novelsData', novels);
    
    // Close the lore editor
    closeLoreEditor();
    
    // Show a confirmation
    alert(`Lore entry "${loreData.name}" has been saved!`);
  }
  
  // Close the lore editor
  function closeLoreEditor() {
    loreEditorContainer.style.display = 'none';
    editorContainer.style.display = 'flex';
  }
  
  // Edit a lore entry
  function editLore(index) {
    if (currentNovelIndex < 0 || !novels[currentNovelIndex].lore) return;
    
    currentLoreIndex = index;
    const loreEntry = novels[currentNovelIndex].lore[index];
    
    // Populate the form with lore data
    loreName.value = loreEntry.name || '';
    loreCategory.value = loreEntry.category || 'Location';
    loreDescription.value = loreEntry.description || '';
    loreNotes.value = loreEntry.notes || '';
    
    // Handle custom category
    if (loreEntry.category === 'Custom') {
      customCategoryContainer.style.display = 'block';
      loreCustomCategory.value = loreEntry.customCategory || '';
    } else {
      customCategoryContainer.style.display = 'none';
    }
    
    // Toggle category fields
    toggleLoreCategoryFields();
    
    // Handle lore images
    loreImagesData = loreEntry.images ? [...loreEntry.images] : [];
    
    // Refresh the images container
    refreshLoreImagesContainer();
    
    // Fill category-specific fields
    if (loreEntry.category === 'Location' && loreEntry.locationDetails) {
      locationType.value = loreEntry.locationDetails.type || 'City';
      locationClimate.value = loreEntry.locationDetails.climate || '';
      locationPopulation.value = loreEntry.locationDetails.population || '';
      locationGovernment.value = loreEntry.locationDetails.government || '';
      locationHistory.value = loreEntry.locationDetails.history || '';
      locationCulture.value = loreEntry.locationDetails.culture || '';
      locationEconomy.value = loreEntry.locationDetails.economy || '';
      locationNotableFeatures.value = loreEntry.locationDetails.notableFeatures || '';
    } else if (loreEntry.category === 'Item' && loreEntry.itemDetails) {
      itemType.value = loreEntry.itemDetails.type || 'Weapon';
      itemCreator.value = loreEntry.itemDetails.creator || '';
      itemAge.value = loreEntry.itemDetails.age || '';
      itemAppearance.value = loreEntry.itemDetails.appearance || '';
      itemMaterials.value = loreEntry.itemDetails.materials || '';
      itemPowers.value = loreEntry.itemDetails.powers || '';
      itemHistory.value = loreEntry.itemDetails.history || '';
      itemOwnership.value = loreEntry.itemDetails.ownership || '';
      itemValue.value = loreEntry.itemDetails.value || '';
    } else if (loreEntry.category === 'Creature' && loreEntry.creatureDetails) {
      creatureType.value = loreEntry.creatureDetails.type || '';
      creatureHabitat.value = loreEntry.creatureDetails.habitat || '';
      creatureAppearance.value = loreEntry.creatureDetails.appearance || '';
      creatureAbilities.value = loreEntry.creatureDetails.abilities || '';
      creatureBehavior.value = loreEntry.creatureDetails.behavior || '';
      creatureDiet.value = loreEntry.creatureDetails.diet || '';
      creatureLifecycle.value = loreEntry.creatureDetails.lifecycle || '';
      creatureSociety.value = loreEntry.creatureDetails.society || '';
      creatureHistory.value = loreEntry.creatureDetails.history || '';
      creatureWeaknesses.value = loreEntry.creatureDetails.weaknesses || '';
    } else if (loreEntry.category === 'Organization' && loreEntry.organizationDetails) {
      orgType.value = loreEntry.organizationDetails.type || 'Government';
      orgLeadership.value = loreEntry.organizationDetails.leadership || '';
      orgHeadquarters.value = loreEntry.organizationDetails.headquarters || '';
      orgStructure.value = loreEntry.organizationDetails.structure || '';
      orgGoals.value = loreEntry.organizationDetails.goals || '';
      orgMethods.value = loreEntry.organizationDetails.methods || '';
      orgResources.value = loreEntry.organizationDetails.resources || '';
      orgHistory.value = loreEntry.organizationDetails.history || '';
      orgAllies.value = loreEntry.organizationDetails.allies || '';
      orgEnemies.value = loreEntry.organizationDetails.enemies || '';
    } else if (loreEntry.category === 'Event' && loreEntry.eventDetails) {
      eventType.value = loreEntry.eventDetails.type || 'Battle';
      eventDate.value = loreEntry.eventDetails.date || '';
      eventLocation.value = loreEntry.eventDetails.location || '';
      eventParticipants.value = loreEntry.eventDetails.participants || '';
      eventCauses.value = loreEntry.eventDetails.causes || '';
      eventOutcome.value = loreEntry.eventDetails.outcome || '';
      eventConsequences.value = loreEntry.eventDetails.consequences || '';
      eventCulturalImpact.value = loreEntry.eventDetails.culturalImpact || '';
      eventCommemoration.value = loreEntry.eventDetails.commemoration || '';
    }
    
    // Hide the novel list and editor containers when showing lore editor
    novelListContainer.style.display = 'none';
    editorContainer.style.display = 'none';
    characterEditorContainer.style.display = 'none';
    timelineContainer.style.display = 'none';
    
    // Show the lore editor
    novelEditorContainer.style.display = 'none';
    loreEditorContainer.style.display = 'flex';
    
    // Hide sidebar in mobile view when not in editor
    if (window.innerWidth <= 768) {
      sidebar.style.display = 'none';
    }
    
    loreEditTitle.textContent = `Edit Lore: ${loreEntry.name}`;
    
  }
  
  // Update the lore list in the sidebar
  function updateLoreList() {
    loreList.innerHTML = '';
    
    if (currentNovelIndex < 0 || currentNovelIndex >= novels.length) return;
    
    // Initialize lore array if it doesn't exist
    if (!novels[currentNovelIndex].lore) {
      novels[currentNovelIndex].lore = [];
    }
    
    let novel = novels[currentNovelIndex];
    
    novel.lore.forEach((loreEntry, index) => {
      let li = document.createElement('li');
      li.className = 'lore-item';
      li.draggable = true;
      li.dataset.index = index;
      li.dataset.type = 'lore';
      
      // Determine the category to display
      let categoryDisplay = loreEntry.category;
      if (loreEntry.category === 'Custom' && loreEntry.customCategory) {
        categoryDisplay = loreEntry.customCategory;
      }
      
      // Check for images
      const hasImages = loreEntry.images && loreEntry.images.length > 0;
      const primaryImage = hasImages ? loreEntry.images[0] : null;
      const totalImages = hasImages ? loreEntry.images.length : 0;
      
      li.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="display:flex; align-items:flex-start; flex:1;">
            <span class="drag-handle">☰</span>
            <div style="display:flex; flex-direction:column;">
            <span class="lore-title" style="width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${loreEntry.name}</span>
            <span style="font-size:0.8em; color:var(--text-light); min-width: 130px !important; width: 130px !important; max-width: 130px !important;">${categoryDisplay}</span>
            ${totalImages > 1 ? `<span style="margin-left:5px; font-size:0.8em; color:var(--secondary);">[${totalImages} images]</span>` : ''}
          </div>
          </div>
          <div>
            <button class="lore-edit-btn" data-index="${index}" style="background:none; border:none; cursor:pointer; color:var(--secondary); font-size:12px; margin-right:5px;">✏️</button>
            <button class="lore-delete-btn" data-index="${index}" style="background:none; border:none; color:var(--danger); cursor:pointer; font-size:12px;">×</button>
          </div>
        </div>
`;
      
      // Add event listeners for drag and drop
      li.addEventListener('dragstart', handleDragStart);
      li.addEventListener('dragover', handleDragOver);
      li.addEventListener('dragleave', handleDragLeave);
      li.addEventListener('drop', handleDrop);
      li.addEventListener('dragend', handleDragEnd);
      
      loreList.appendChild(li);
      
      // Add click handler to edit when clicking on lore name
      li.querySelector('.lore-title').addEventListener('click', function(e) {
        e.stopPropagation();
        editLore(index);
      });
      
      // Add click handlers for edit and delete buttons
      li.querySelector('.lore-edit-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        editLore(parseInt(e.target.dataset.index));
      });
      
      li.querySelector('.lore-delete-btn').addEventListener('click', function(e) {
        e.stopPropagation();
        removeLore(parseInt(e.target.dataset.index));
      });
    });
  }
  
  // Remove a lore entry
  async function removeLore(index) {
    if (currentNovelIndex < 0 || !novels[currentNovelIndex].lore) return;
    
    const loreEntry = novels[currentNovelIndex].lore[index];
    
    if (confirm(`Are you sure you want to delete the lore entry "${loreEntry.name}"?`)) {
      novels[currentNovelIndex].lore.splice(index, 1);
      updateLoreList();
      await saveToIndexedDB('novels', 'novelsData', novels); // Save to IndexedDB
    }
  }
  
  // Format text in the editor
  function formatText(command, value = null) {
    // Special handling for indent and outdent commands
    if (command === 'indent') {
      indentFirstLineOnly();
    } else if (command === 'outdent') {
      outdentFirstLineOnly();
    } else {
      // Default behavior for other commands
      document.execCommand(command, false, value);
    }
    
    editor.focus();
    
    // Save to IndexedDB after formatting
    autoSaveEdit();
  }

  // Indent only the first line of selected paragraphs
  function indentFirstLineOnly() {
    // Get selected paragraphs
    const paragraphs = getSelectedParagraphs();
    
    // Apply first line indentation
    paragraphs.forEach(p => {
      const currentIndent = parseInt(window.getComputedStyle(p).textIndent) || 0;
      p.style.textIndent = (currentIndent + 40) + 'px';
    });
  }

  // Outdent only the first line of selected paragraphs
  function outdentFirstLineOnly() {
    // Get selected paragraphs
    const paragraphs = getSelectedParagraphs();
    
    // Reduce first line indentation
    paragraphs.forEach(p => {
      const currentIndent = parseInt(window.getComputedStyle(p).textIndent) || 0;
      if (currentIndent > 0) {
        p.style.textIndent = Math.max(currentIndent - 40, 0) + 'px';
      }
    });
  }

  // Helper function to get paragraphs in selection
  function getSelectedParagraphs() {
    const selection = window.getSelection();
    if (!selection.rangeCount) return [];
    
    const range = selection.getRangeAt(0);
    const paragraphs = [];
    
    // If selection is collapsed (cursor)
    if (range.collapsed) {
      let node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode;
      }
      
      while (node && node !== editor) {
        if (isParagraphElement(node)) {
          paragraphs.push(node);
          break;
        }
        node = node.parentNode;
      }
    } 
    // If selection spans multiple nodes
    else {
      const allParagraphs = editor.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, blockquote, pre');
      
      allParagraphs.forEach(p => {
        if (nodeIntersectsRange(p, range)) {
          paragraphs.push(p);
        }
      });
    }
    
    return paragraphs;
  }

  // Check if element is paragraph-like
  function isParagraphElement(node) {
    if (!node || node.nodeType !== Node.ELEMENT_NODE) return false;
    const name = node.nodeName.toLowerCase();
    return ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre'].includes(name);
  }

  // Check if node intersects with range
  function nodeIntersectsRange(node, range) {
    // Simple check if node contains either the start or end of the range
    return node.contains(range.startContainer) || node.contains(range.endContainer);
  }
  
  // Insert link
  function insertLink() {
    let url = prompt('Enter the URL:', 'http://');
    if (url) {
      let text = document.getSelection().toString();
      if (!text) {
        text = url;
      }
      formatText('insertHTML', `<a href="${url}" target="_blank">${text}</a>`);
    }
  }
  
  // Image Modal Functions
  function insertImage() {
    // Reset the form
    imageUrl.value = '';
    imageAltUrl.value = '';
    imageFile.value = '';
    imageAltUpload.value = '';
    imagePreview.style.display = 'none';
    
    // Show URL tab by default
    switchImageTab('url');
    
    // Show the modal
    imageModal.style.display = 'flex';
  }
  
  function switchImageTab(tab) {
    if (tab === 'url') {
      urlTab.style.display = 'block';
      uploadTab.style.display = 'none';
      urlTabBtn.style.background = 'var(--primary)';
      urlTabBtn.style.color = 'white';
      uploadTabBtn.style.background = 'var(--toolbar-bg)';
      uploadTabBtn.style.color = 'var(--text)';
    } else {
      urlTab.style.display = 'none';
      uploadTab.style.display = 'block';
      urlTabBtn.style.background = 'var(--toolbar-bg)';
      urlTabBtn.style.color = 'var(--text)';
      uploadTabBtn.style.background = 'var(--primary)';
      uploadTabBtn.style.color = 'white';
    }
  }
  
  function previewImage() {
    const file = imageFile.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(e) {
        previewImg.src = e.target.result;
        imagePreview.style.display = 'block';
      };
      reader.readAsDataURL(file);
    } else {
      imagePreview.style.display = 'none';
    }
  }
  
  function confirmInsertImage() {
    let imageHtml = '';
    let altText = '';
    
    // Check which tab is active
    if (urlTab.style.display !== 'none') {
      // URL tab is active
      if (!imageUrl.value) {
        alert('Please enter an image URL.');
        return;
      }
      altText = imageAltUrl.value;
      imageHtml = `<img src="${imageUrl.value}" alt="${altText}" style="max-width:100%;">`;
    } else {
      // Upload tab is active
      if (!imageFile.files[0]) {
        alert('Please select an image to upload.');
        return;
      }
      altText = imageAltUpload.value;
      imageHtml = `<img src="${previewImg.src}" alt="${altText}" style="max-width:100%;">`;
    }
    
    formatText('insertHTML', imageHtml);
    closeImageModal();
    
    // Save to IndexedDB after inserting image
    autoSaveEdit();
  }
  
  function closeImageModal() {
    imageModal.style.display = 'none';
    editor.focus();
  }
  
  // Color modals and functions
  function showTextColorModal() {
    textColorModalPicker.value = "#000000"; // Default black
    textColorModal.style.display = 'flex';
  }

  function closeTextColorModal() {
    textColorModal.style.display = 'none';
    editor.focus();
  }

  function applyTextColor(color) {
    formatText('foreColor', color);
    closeTextColorModal();
  }

  function unsetTextColor() {
    formatText('removeFormat');
    closeTextColorModal();
  }

  function showBgColorModal() {
    bgColorModalPicker.value = "#ffffff"; // Default white
    bgColorModal.style.display = 'flex';
  }

  function closeBgColorModal() {
    bgColorModal.style.display = 'none';
    editor.focus();
  }

  function applyBgColor(color) {
    formatText('hiliteColor', color);
    closeBgColorModal();
  }

  function unsetBgColor() {
    formatText('hiliteColor', 'transparent');
    closeBgColorModal();
  }
  
  // Special Characters Modal Functions
  function showSpecialCharacters() {
    specialCharModal.style.display = 'flex';
  }
  
  function insertSpecialChar(char) {
    formatText('insertText', char);
    closeSpecialCharModal();
  }
  
  function closeSpecialCharModal() {
    specialCharModal.style.display = 'none';
    editor.focus();
  }
  
  // Insert table
  function insertTable() {
    let rows = prompt('Enter number of rows:', '3');
    let cols = prompt('Enter number of columns:', '3');
    
    if (rows && cols) {
      rows = parseInt(rows);
      cols = parseInt(cols);
      
      if (isNaN(rows) || isNaN(cols) || rows < 1 || cols < 1) {
        alert('Please enter valid numbers for rows and columns.');
        return;
      }
      
      let table = '<table border="1" style="width:100%;"><tbody>';
      
      // Create header row
      table += '<tr>';
      for (let j = 0; j < cols; j++) {
        table += '<th>Header ' + (j+1) + '</th>';
      }
      table += '</tr>';
      
      // Create data rows
      for (let i = 0; i < rows; i++) {
        table += '<tr>';
        for (let j = 0; j < cols; j++) {
          table += '<td>Cell ' + (i+1) + ',' + (j+1) + '</td>';
        }
        table += '</tr>';
      }
      
      table += '</tbody></table>';
      formatText('insertHTML', table);
      
      // Save to IndexedDB after inserting table
      autoSaveEdit();
    }
  }
  
  // Insert horizontal rule
  function insertHorizontalRule() {
    formatText('insertHorizontalRule');
    
    // Save to IndexedDB after inserting horizontal rule
    autoSaveEdit();
  }
  
  // Update word count
  function updateWordCount() {
    const text = editor.innerText || '';
    const words = text.trim().split(/\s+/).filter(word => word.length > 0);
    wordCount.textContent = words.length;
  }
  
  // Save all novels to IndexedDB
  async function saveNovels() {
    saveCurrentChapter();
    await saveToIndexedDB('novels', 'novelsData', novels);
    alert('All novels saved successfully!');
  }
  
  // Load novels from IndexedDB
  async function loadNovels() {
    try {
      const data = await getFromIndexedDB('novels', 'novelsData');
      if (!data) {
        // No data found, create a new novel
        novels = [];
        addNovel();
        return;
      }
      
      novels = data;
      
      // Ensure all novels have a characters array
      for (let novel of novels) {
        if (!novel.characters) {
          novel.characters = [];
        }
        
        // Add a lore array if it doesn't exist (for backwards compatibility)
        if (!novel.lore) {
          novel.lore = [];
        }
        
        // Ensure all chapters have a summary property (for backwards compatibility)
        if (novel.chapters) {
          for (let chapter of novel.chapters) {
            if (!chapter.hasOwnProperty('summary')) {
              chapter.summary = '';
            }
          }
        }
        
        // Add a timeline array if it doesn't exist (for backwards compatibility)
        if (!novel.timeline) {
          novel.timeline = [];
        }
        
        // Add timeline settings if they don't exist
        if (!novel.timelineSettings) {
          novel.timelineSettings = JSON.parse(JSON.stringify(timelineSettings));
        }
      }
      
      if (novels.length > 0) {
        currentNovelIndex = 0; // Default to first novel
        updateChapterList();
        updateCharacterList();
        updateLoreList();
        updateNovelList();
        
        // Load the first chapter of the current novel
        let novel = novels[currentNovelIndex];
        if (novel.chapters.length > 0) {
          loadChapter(novel.currentChapterIndex >= 0 ? novel.currentChapterIndex : 0);
        } else {
          addChapter();
        }
      } else {
        addNovel();
      }
    } catch (e) {
      console.error('Error loading novels:', e);
      alert('Error loading novels: ' + e.message);
      novels = [];
      addNovel();
    }
  }
  
  // Toggle menu dropdown
  function toggleMenu() {
    const menuDropdown = document.getElementById('menuDropdown');
    if (menuDropdown.style.display === "none" || menuDropdown.style.display === "") {
      menuDropdown.style.display = "block";
      setTimeout(() => document.addEventListener('click', closeMenuOutside), 0);
    } else {
      menuDropdown.style.display = "none";
      document.removeEventListener('click', closeMenuOutside);
    }
  }

  // Close menu when clicking outside
  function closeMenuOutside(event) {
    const menuContainer = document.getElementById("menuContainer");
    if (!menuContainer.contains(event.target)) {
      document.getElementById("menuDropdown").style.display = "none";
      document.removeEventListener('click', closeMenuOutside);
    }
  }
  
  // Export all data as a text file
  async function exportAllData() {
    // Save any current changes first
    saveCurrentChapter();
    
    // Get settings data from IndexedDB
    const settingsData = {};
    try {
      const keys = await getAllKeysFromIndexedDB('settings');
      for (const key of keys) {
        settingsData[key] = await getFromIndexedDB('settings', key);
      }
    } catch (error) {
      console.error('Error getting settings data:', error);
    }
    
    // Create a complete data object that includes everything
    let fullDataExport = {
      novels: novels,
      currentNovelIndex: currentNovelIndex,
      // Include additional data from IndexedDB
      additionalData: settingsData
    };
    
    // Convert to JSON string
    let jsonStr = JSON.stringify(fullDataExport, null, 2);
    
    // Create a blob and download
    const blob = new Blob([jsonStr], { type: 'text/plain' });
    const filename = 'promised-pen-backup.txt';
    downloadFile(blob, filename);
  }
  
  // Import data from a text file
  function importData() {
    // Trigger the file input
    importFile.click();
  }
  
  // Handle the import file selection
  async function handleImportFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async function(e) {
      try {
        const importedData = JSON.parse(e.target.result);
        
        // Validate the imported data has the expected structure
        if (!importedData.novels || !Array.isArray(importedData.novels)) {
          throw new Error('Invalid data format: missing novels array');
        }
        
        // Prompt user to confirm import as it will replace all current data
        if (confirm('This will replace all your current novels and data. Continue?')) {
          // Import the data
          novels = importedData.novels;
          currentNovelIndex = importedData.currentNovelIndex || 0;
          
          // Import any additional IndexedDB data
          if (importedData.additionalData) {
            for (const key in importedData.additionalData) {
              await saveToIndexedDB('settings', key, importedData.additionalData[key]);
            }
          }
          
          // Update the UI
          updateNovelList();
          updateChapterList();
          updateCharacterList();
          updateLoreList();
          
          // Load the current chapter
          if (currentNovelIndex >= 0 && novels[currentNovelIndex].chapters.length > 0) {
            loadChapter(novels[currentNovelIndex].currentChapterIndex >= 0 ? 
                      novels[currentNovelIndex].currentChapterIndex : 0);
          }
          
          // Save to IndexedDB
          await saveToIndexedDB('novels', 'novelsData', novels);
          
          alert('Data imported successfully!');
        }
        
      } catch (error) {
        alert('Error importing data: ' + error.message);
      }
      // Reset the file input for next use
      importFile.value = '';
    };
    reader.readAsText(file);
  }

  // Helper function to download a file
  function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Function to use AI for text generation/improvement
  async function useAI(directEditor = true, options = {}) {
    // If in summary mode, we handle it differently
    if (options.mode === 'summary') {
      // Create a prompt specifically for summarizing a chapter
      const chapterContent = options.chapterContent || '';
      const prompt = [{ role: 'assistant', content: `Please summarize the following chapter in a concise way, highlighting the key events, character developments, and important plot points. Keep the summary to 3-5 paragraphs. Only return the summary text without any explanations or comments. \n\nChapter content:\n${chapterContent}` }];
      
      try {
        const url = 'https://text.pollinations.ai/openai';
        const seedVar = Math.floor(Math.random() * 1000000);
        const payload = {
          model: 'openai-large',
          messages: prompt,
          seed: seedVar,
          private: true,
          max_tokens: 1000000,
        };
        
        // Call the Pollinations API
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        // Parse the response
        const result = await response.json();
        
        // Extract the generated text
        let generatedText = '';
        
        if (result.choices && result.choices.length > 0) {
          if (result.choices[0].text) {
            generatedText = result.choices[0].text;
          } else if (result.choices[0].message && result.choices[0].message.content) {
            generatedText = result.choices[0].message.content;
          }
        } else if (result.content) {
          generatedText = result.content;
        } else if (typeof result === 'string') {
          generatedText = result;
        } else {
          console.log('Unable to extract text from response:', result);
          throw new Error('Unable to parse AI response');
        }
        
        return generatedText;
      } catch (error) {
        console.error('Error generating summary:', error);
        throw error;
      }
    }
    
    // Original useAI function for the editor
    if (directEditor) {
      // Check if text is selected
      let selection = window.getSelection();
      if (!selection.rangeCount) {
        alert("Please make a selection or place your cursor in the editor.");
        return;
      }
      
      let range = selection.getRangeAt(0);
      let selectedText = selection.toString();
      let isInEditor = editor.contains(range.commonAncestorContainer);
      
      if (!isInEditor) {
        alert("Please make a selection or place your cursor in the editor.");
        return;
      }
      
      // Disable the button and show loading state
      AIgen.disabled = true;
      AIgen.textContent = "⏳";
      
      try {
        // Get previous chapters and content before the selection
        let previousChapters = getPreviousChapters();
        let contentBeforeSelection = getContentBeforeCursor(range);
        
        // Get character and lore information
        let characterInfo = getCharacterInfo();
        let loreInfo = getLoreInfo();
        
        // Prepare the prompt based on whether text is selected or not
        let prompt = "";
        seedVar = Math.floor(Math.random() * 1000000);
        if (selectedText) {
          prompt = [{ role: `system`, content: `You are a writing assistant helping to improve a novel. Based on the story context, character information, and world lore provided, rewrite the selected text to improve it while maintaining the original style, tone and narrative flow.\n\n${characterInfo}\n${loreInfo}\n\nContext from previous chapters:\n${previousChapters}\n\nContent before the selection:\n${contentBeforeSelection}\n\nRewrite the selected text with better prose, more vivid descriptions, and better character consistency. Only return the improved text without any explanations or comments based on the following text:\n"${selectedText}"`, }];
        } else {
          prompt = [{ role: `assistant`, content: `Creatively continue the story with the established style, tone, and narrative using the information and context provided. Ensure that the text allows for mature content, vulgar and profane language, and graphic violence if the context allows for it. Character information: ${characterInfo}. World Lore: ${loreInfo}. Context from previous chapters: ${previousChapters}. Content so far: ${contentBeforeSelection}. Only return the text without any explanations or comments.`, }];
        }
        const url = 'https://text.pollinations.ai/openai';
        const payload = {
            model: 'openai-large',
            messages: prompt,
            seed: seedVar, // Random seed
            private: true,
            max_tokens: 1000000, // Adjust as needed
          };
        // Call the Pollinations API
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        console.log("Sending POST request to:", url, payload);
        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }
        
        // Parse the response
        const result = await response.json();
        
        // Extract the generated text
        let generatedText = '';
        
        if (result.choices && result.choices.length > 0) {
          if (result.choices[0].text) {
            generatedText = result.choices[0].text;
          } else if (result.choices[0].message && result.choices[0].message.content) {
            generatedText = result.choices[0].message.content;
          }
        } else if (result.content) {
          generatedText = result.content;
        } else if (typeof result === 'string') {
          generatedText = result;
        } else {
          console.log('Unable to extract text from response:', result);
          throw new Error('Unable to parse AI response');
        }
        
        // Replace selected text or insert at cursor
        if (selectedText) {
          document.execCommand('insertText', false, generatedText);
        } else {
          document.execCommand('insertText', false, generatedText);
        }
        
        // Save the current chapter
        autoSaveEdit();
      } catch (error) {
        console.error('Error generating text:', error);
        alert('An error occurred while generating text. Please try again.');
      } finally {
        // Re-enable the button
        AIgen.disabled = false;
        AIgen.textContent = "AI";
      }
    }
  }
  
  // Get content from previous chapters
  function getPreviousChapters() {
    if (currentNovelIndex < 0) return "";
    
    let novel = novels[currentNovelIndex];
    let currentChapterIndex = novel.currentChapterIndex;
    let previousChaptersContent = [];
    
    // Get content from up to 3 previous chapters to avoid too large prompts
    for (let i = Math.max(0, currentChapterIndex - 3); i < currentChapterIndex; i++) {
      if (novel.chapters[i]) {
        let textContent = novel.chapters[i].content.replace(/<[^>]*>/g, ' ');
        previousChaptersContent.push(`Chapter ${i+1}: ${textContent}`);
      }
    }
    
    return previousChaptersContent.join("\n\n");
  }
  
  // Get content before the cursor in the current chapter
  function getContentBeforeCursor(range) {
    // Clone the range
    let beforeRange = range.cloneRange();
    beforeRange.setStart(editor, 0);
    beforeRange.setEnd(range.startContainer, range.startOffset);
    
    // Get the text content of the range
    let beforeContent = beforeRange.toString();
    
    return beforeContent;
  }
  
  // Get character information formatted for the prompt
  function getCharacterInfo() {
    if (currentNovelIndex < 0 || !novels[currentNovelIndex].characters) return "";
    
    let characterInfoText = "## Character Information:\n\n";
    let novel = novels[currentNovelIndex];
    
    novel.characters.forEach(character => {
      characterInfoText += `### ${character.name} (${character.role}):\n`;
      
      if (character.appearance) {
        characterInfoText += `Appearance: ${character.appearance.height || ''} ${character.appearance.build || ''}, `;
        characterInfoText += `hair: ${character.appearance.hair || ''}, eyes: ${character.appearance.eyes || ''}, `;
        characterInfoText += `skin: ${character.appearance.skin || ''}\n`;
      }
      
      if (character.personality) {
        characterInfoText += `Personality: ${character.personality}\n`;
      }
      
      if (character.backstory) {
        characterInfoText += `Backstory: ${character.backstory}\n`;
      }
      
      if (character.motivation) {
        characterInfoText += `Motivation: ${character.motivation}\n`;
      }
      
      characterInfoText += "\n";
    });
    
    return characterInfoText;
  }
  
  // Get lore information formatted for the prompt
  function getLoreInfo() {
    if (currentNovelIndex < 0 || !novels[currentNovelIndex].lore) return "";
    
    let loreInfoText = "## World and Lore Information:\n\n";
    let novel = novels[currentNovelIndex];
    
    novel.lore.forEach(loreEntry => {
      let categoryDisplay = loreEntry.category;
      if (loreEntry.category === 'Custom' && loreEntry.customCategory) {
        categoryDisplay = loreEntry.customCategory;
      }
      
      loreInfoText += `### ${loreEntry.name} (${categoryDisplay}):\n`;
      loreInfoText += `${loreEntry.description}\n\n`;
    });
    
    return loreInfoText;
  }
  
  // Timer functions
  async function openTimerModal() {
    // Load saved timer minutes value from IndexedDB if it exists
    const savedMinutes = await getFromIndexedDB('settings', 'timerMinutes');
    if (savedMinutes) {
      timerMinutes.value = savedMinutes;
    }
    timerModal.style.display = 'flex';
  }

  function closeTimerModal() {
    timerModal.style.display = 'none';
  }

  async function startTimer() {
    // Get the minutes from the input
    let minutes = parseInt(timerMinutes.value);
    
    // Validate input
    if (isNaN(minutes) || minutes < 1) {
      alert('Please enter a valid number of minutes (minimum 1).');
      return;
    }
    
    // Save the minutes value to IndexedDB
    await saveToIndexedDB('settings', 'timerMinutes', minutes);
    
    // Calculate end time
    let now = new Date();
    timerEndTime = new Date(now.getTime() + minutes * 60000);
    
    // Update display
    updateTimerDisplay();
    
    // Set interval to update the display
    timerInterval = setInterval(updateTimerDisplay, 1000);
    
    // Show timer display
    timerDisplay.style.display = 'block';
    
    // Close the modal
    closeTimerModal();
  }

  function updateTimerDisplay() {
    if (!timerEndTime) return;
    
    // Calculate remaining time
    let now = new Date();
    let diff = timerEndTime - now;
    
    if (diff <= 0) {
      // Timer is done
      clearInterval(timerInterval);
      timerInterval = null;
      timerEndTime = null;
      timerDisplay.style.display = 'none';
      
      // Show alert
      alert('Writing sprint timer complete!');
      return;
    }
    
    // Calculate minutes and seconds
    let minutes = Math.floor(diff / 60000);
    let seconds = Math.floor((diff % 60000) / 1000);
    
    // Display time in MM:SS format
    timerRemainingDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  function cancelTimer() {
    if (confirm('Are you sure you want to cancel the timer?')) {
      clearInterval(timerInterval);
      timerInterval = null;
      timerEndTime = null;
      timerDisplay.style.display = 'none';
    }
  }

  // Timeline functions
  // Open the timeline view
  async function openTimeline() {
    if (currentNovelIndex < 0) return;
    
    // Save current work if needed
    saveCurrentChapter();
    
    // Hide other containers
    novelListContainer.style.display = 'none';
    editorContainer.style.display = 'none';
    characterEditorContainer.style.display = 'none';
    loreEditorContainer.style.display = 'none';
    novelEditorContainer.style.display = 'none';
    
    // Initialize timeline if it's the first time
    initializeTimeline();
    
    // Show the timeline container
    timelineContainer.style.display = 'flex';
    
    // Default to the last saved view mode
    switchTimelineView(timelineSettings.viewMode || 'vertical');
    
    // Load timeline events from the current novel
    loadTimelineEvents();
  }

  // Close the timeline view
  function closeTimeline() {
    timelineContainer.style.display = 'none';
    editorContainer.style.display = 'flex';
  }

  // Initialize timeline for first use
  function initializeTimeline() {
    // Ensure the current novel has a timeline array
    if (!novels[currentNovelIndex].timeline) {
      novels[currentNovelIndex].timeline = [];
    }
    
    // Load saved timeline settings if they exist
    if (novels[currentNovelIndex].timelineSettings) {
      timelineSettings = novels[currentNovelIndex].timelineSettings;
    } else {
      // Save default settings
      novels[currentNovelIndex].timelineSettings = timelineSettings;
    }
  }

  // Switch between horizontal and vertical timeline views
  function switchTimelineView(mode) {
    timelineSettings.viewMode = mode;
    timelineViewMode.value = mode;
    
    if (mode === 'horizontal') {
      horizontalTimeline.style.display = 'block';
      verticalTimeline.style.display = 'none';
    } else {
      horizontalTimeline.style.display = 'none';
      verticalTimeline.style.display = 'block';
    }
    
    // Reload the events in the selected view
    loadTimelineEvents();
    
    // Save the setting
    novels[currentNovelIndex].timelineSettings = timelineSettings;
    saveToIndexedDB('novels', 'novelsData', novels);
  }

  // Load timeline events from the current novel
  function loadTimelineEvents() {
    // Clear existing events
    timelineEventsContainer.innerHTML = '';
    verticalTimelineEventsContainer.innerHTML = '';
    
    if (!novels[currentNovelIndex].timeline || novels[currentNovelIndex].timeline.length === 0) {
      // No events yet, show a placeholder
      timelineEventsContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-light);">No events yet. Click "Add Event" to create your first timeline event.</div>';
      verticalTimelineEventsContainer.innerHTML = '<div style="text-align:center; padding:20px; color:var(--text-light);">No events yet. Click "Add Event" to create your first timeline event.</div>';
      return;
    }
    
    // Create a copy of events with original indices
    let events = novels[currentNovelIndex].timeline.map((event, index) => ({
      ...event,
      originalIndex: index
    }));
    
    // Sort events by date
    events.sort((a, b) => {
      // First by era priority
      const eraA = timelineSettings.eras.findIndex(era => era.name === a.era);
      const eraB = timelineSettings.eras.findIndex(era => era.name === b.era);
      if (eraA !== eraB) return eraA - eraB;
      
      // Then by year
      if (a.year !== b.year) return a.year - b.year;
      
      // Then by month
      if (a.month !== b.month) return a.month - b.month;
      
      // Then by day
      return a.day - b.day;
    });
    
    // Create a date-line with evenly spaced markers
    if (timelineSettings.viewMode === 'horizontal') {
      renderHorizontalTimeline(events);
    } else {
      renderVerticalTimeline(events);
    }
  }

  // Render horizontal timeline
  function renderHorizontalTimeline(events) {
    // Create markers for significant dates
    let timelineWidth = Math.max(events.length * 200, 1000) + 'px';
    horizontalTimeline.style.width = timelineWidth;
    
    // Clear previous events
    timelineEventsContainer.innerHTML = '';
    
    // Calculate positions for events
    const totalWidth = parseInt(timelineWidth);
    const startPadding = 50;
    const endPadding = 50;
    const usableWidth = totalWidth - startPadding - endPadding;
    const eventSpacing = usableWidth / (events.length > 1 ? events.length - 1 : 1);
    
    // Create events
    events.forEach((event, index) => {
      const position = events.length > 1 ? startPadding + (index * eventSpacing) : totalWidth / 2;
      
      // Create event marker
      const eventMarker = document.createElement('div');
      eventMarker.className = 'timeline-event';
      eventMarker.style.cssText = `
        position:absolute;
        left:${position}px;
        top:0;
        transform:translateX(-50%);
        display:flex;
        flex-direction:column;
        align-items:center;
      `;
      
      // Marker dot
      const dot = document.createElement('div');
      dot.style.cssText = `
        width:12px;
        height:12px;
        border-radius:50%;
        background-color:${event.color || 'var(--primary)'};
        margin-bottom:5px;
        transform:translateY(15px);
        cursor:pointer;
        border:2px solid var(--background);
      `;
      dot.onclick = () => editTimelineEvent(event.originalIndex); // Use original index
      eventMarker.appendChild(dot);
      
      // Date label
      const dateLabel = document.createElement('div');
      dateLabel.style.cssText = `
        font-size:12px;
        color:var(--text-light);
        white-space:nowrap;
        transform:translateY(-20px);
      `;
      let dateText = `${event.year} ${timelineSettings.eras.find(era => era.name === event.era)?.abbreviation || event.era}`;
      if (event.month) {
        dateText = `${timelineSettings.months[event.month - 1]} ${event.day || ''}, ${dateText}`;
      }
      dateLabel.textContent = dateText;
      eventMarker.appendChild(dateLabel);
      
      // Event title (below the line)
      const titleElement = document.createElement('div');
      titleElement.style.cssText = `
        font-size:14px;
        font-weight:bold;
        margin-top:15px;
        margin-bottom:5px;
        color:var(--text);
        cursor:pointer;
        max-width:150px;
        text-align:center;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      `;
      titleElement.title = event.title;
      titleElement.textContent = event.title;
      titleElement.onclick = () => editTimelineEvent(event.originalIndex); // Use original index
      eventMarker.appendChild(titleElement);
      
      timelineEventsContainer.appendChild(eventMarker);
    });
  }

  // Render vertical timeline
  function renderVerticalTimeline(events) {
    // Create markers for significant dates
    let timelineHeight = Math.max(events.length * 150, 500) + 'px';
    verticalTimeline.style.height = timelineHeight;
    
    // Clear previous events
    verticalTimelineEventsContainer.innerHTML = '';
    
    // Calculate positions for events
    const totalHeight = parseInt(timelineHeight);
    const startPadding = 50;
    const endPadding = 50;
    const usableHeight = totalHeight - startPadding - endPadding;
    const eventSpacing = usableHeight / (events.length > 1 ? events.length - 1 : 1);
    
    // Create events
    events.forEach((event, index) => {
      const position = events.length > 1 ? startPadding + (index * eventSpacing) : totalHeight / 2;
      const isEven = index % 2 === 0;
      
      // Create event marker
      const eventMarker = document.createElement('div');
      eventMarker.className = 'timeline-event';
      eventMarker.style.cssText = `
        position:absolute;
        top:${position}px;
        ${isEven ? 'left:calc(50% + 20px)' : 'right:calc(50% + 20px)'};
        transform:translateY(-50%);
        display:flex;
        ${isEven ? 'flex-direction:row' : 'flex-direction:row-reverse'};
        align-items:center;
        max-width:40%;
      `;
      
      // Connector line
      const connector = document.createElement('div');
      connector.style.cssText = `
        height:2px;
        width:20px;
        background-color:${event.color || 'var(--primary)'};
        ${isEven ? 'margin-right:10px' : 'margin-left:10px'};
      `;
      eventMarker.appendChild(connector);
      
      // Marker dot (at the center axis)
      const dot = document.createElement('div');
      dot.style.cssText = `
        position:absolute;
        ${isEven ? 'left:-26px' : 'right:-26px'};
        top:50%;
        transform:translateY(-50%);
        width:12px;
        height:12px;
        border-radius:50%;
        background-color:${event.color || 'var(--primary)'};
        cursor:pointer;
        border:2px solid var(--background);
      `;
      dot.onclick = () => editTimelineEvent(event.originalIndex); // Use original index
      eventMarker.appendChild(dot);
      
      // Content container
      const content = document.createElement('div');
      content.style.cssText = `
        background:var(--background);
        border:1px solid var(--border);
        border-radius:4px;
        padding:10px;
        box-shadow:0 2px 5px var(--shadow);
        cursor:pointer;
      `;
      content.onclick = () => editTimelineEvent(event.originalIndex); // Use original index
      eventMarker.appendChild(content);
      
      // Date label
      const dateLabel = document.createElement('div');
      dateLabel.style.cssText = `
        font-size:12px;
        color:var(--text-light);
        margin-bottom:5px;
      `;
      let dateText = `${event.year} ${timelineSettings.eras.find(era => era.name === event.era)?.abbreviation || event.era}`;
      if (event.month) {
        dateText = `${timelineSettings.months[event.month - 1]} ${event.day || ''}, ${dateText}`;
      }
      dateLabel.textContent = dateText;
      content.appendChild(dateLabel);
      
      // Event title
      const titleElement = document.createElement('div');
      titleElement.style.cssText = `
        font-size:14px;
        font-weight:bold;
        margin-bottom:5px;
        color:var(--text);
      `;
      titleElement.textContent = event.title;
      content.appendChild(titleElement);
      
      // Event description (if not too long)
      if (event.description) {
        const descElement = document.createElement('div');
        descElement.style.cssText = `
          font-size:12px;
          color:var(--text);
          display:-webkit-box;
          -webkit-line-clamp:3;
          -webkit-box-orient:vertical;
          overflow:hidden;
          text-overflow:ellipsis;
        `;
        descElement.textContent = event.description;
        content.appendChild(descElement);
      }
      
      verticalTimelineEventsContainer.appendChild(eventMarker);
    });
  }

  // Add a new timeline event
  function addTimelineEvent() {
    // Reset the form
    timelineEventForm.reset();
    eventColor.value = '#4285f4';
    currentTimelineEventIndex = -1;
    
    // Hide delete button for new events
    deleteTimelineEventBtn.style.display = 'none';
    
    // Populate era dropdown
    populateEraDropdown();
    
    // Populate month dropdown
    populateMonthDropdown();
    
    // Update modal title
    timelineEventModalTitle.textContent = 'Add Timeline Event';
    
    // Show the modal
    timelineEventModal.style.display = 'flex';
  }

  // Edit an existing timeline event
  function editTimelineEvent(index) {
    if (currentNovelIndex < 0 || !novels[currentNovelIndex].timeline) return;
    
    currentTimelineEventIndex = index;
    const event = novels[currentNovelIndex].timeline[index];
    
    // Populate the form with event data
    eventTitle.value = event.title || '';
    
    // Populate era dropdown and select the right option
    populateEraDropdown();
    eventEra.value = event.era || 'Current Era';
    
    // Populate month dropdown and select the right option
    populateMonthDropdown();
    eventMonth.value = event.month || '';
    
    eventYear.value = event.year || '';
    eventDay.value = event.day || '';
    eventDescription.value = event.description || '';
    eventColor.value = event.color || '#4285f4';
    
    // Show delete button for existing events
    deleteTimelineEventBtn.style.display = 'block';
    
    // Update modal title
    timelineEventModalTitle.textContent = 'Edit Timeline Event';
    
    // Show the modal
    timelineEventModal.style.display = 'flex';
  }

  // Save a timeline event
  async function saveTimelineEvent(event) {
    event.preventDefault();
    
    if (currentNovelIndex < 0) return;
    
    // Ensure timeline array exists
    if (!novels[currentNovelIndex].timeline) {
      novels[currentNovelIndex].timeline = [];
    }
    
    // Get event data from form
    const timelineEvent = {
      title: eventTitle.value,
      era: eventEra.value,
      year: parseInt(eventYear.value),
      month: eventMonth.value ? parseInt(eventMonth.value) : null,
      day: eventDay.value ? parseInt(eventDay.value) : null,
      description: eventDescription.value,
      color: eventColor.value
    };
    
    if (currentTimelineEventIndex === -1) {
      // Add new event
      novels[currentNovelIndex].timeline.push(timelineEvent);
    } else {
      // Update existing event
      novels[currentNovelIndex].timeline[currentTimelineEventIndex] = timelineEvent;
    }
    
    // Save to IndexedDB
    await saveToIndexedDB('novels', 'novelsData', novels);
    
    // Reload timeline events
    loadTimelineEvents();
    
    // Close the modal
    closeTimelineEventModal();
  }

  // Delete a timeline event
  async function deleteTimelineEvent() {
    if (currentNovelIndex < 0 || currentTimelineEventIndex < 0) return;
    
    if (confirm('Are you sure you want to delete this timeline event?')) {
      // Remove the event
      novels[currentNovelIndex].timeline.splice(currentTimelineEventIndex, 1);
      
      // Save to IndexedDB
      await saveToIndexedDB('novels', 'novelsData', novels);
      
      // Reload timeline events
      loadTimelineEvents();
      
      // Close the modal
      closeTimelineEventModal();
    }
  }

  // Close the timeline event modal
  function closeTimelineEventModal() {
    timelineEventModal.style.display = 'none';
  }

  // Open timeline settings modal
  function openTimelineSettings() {
    // Load current settings
    populateTimelineSettingsForm();
    
    // Show the modal
    timelineSettingsModal.style.display = 'flex';
  }

  // Populate the timeline settings form with current settings
  function populateTimelineSettingsForm() {
    // Populate eras section
    populateErasSection();
    
    // Set number of months
    numMonths.value = timelineSettings.months.length;
    
    // Populate months inputs
    updateMonthsInputs();
    
    // Set number of days in week
    numDaysInWeek.value = timelineSettings.daysInWeek.length;
    
    // Populate days inputs
    updateDaysInputs();
    
    // Populate month lengths
    updateMonthLengthsInputs();
  }

  // Populate the eras section
  function populateErasSection() {
    erasContainer.innerHTML = '';
    
    timelineSettings.eras.forEach((era, index) => {
      const eraRow = document.createElement('div');
      eraRow.style.cssText = 'display:flex; gap:10px; margin-bottom:10px; align-items:center;';
      
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.value = era.name;
      nameInput.placeholder = 'Era Name';
      nameInput.required = true;
      nameInput.style.cssText = 'flex:2; padding:8px; background:var(--input-bg); color:var(--text); border:1px solid var(--input-border); border-radius:4px;';
      nameInput.dataset.index = index;
      nameInput.dataset.field = 'name';
      nameInput.onchange = updateEraField;
      eraRow.appendChild(nameInput);
      
      const abbrInput = document.createElement('input');
      abbrInput.type = 'text';
      abbrInput.value = era.abbreviation;
      abbrInput.placeholder = 'Abbr.';
      abbrInput.required = true;
      abbrInput.style.cssText = 'flex:1; padding:8px; background:var(--input-bg); color:var(--text); border:1px solid var(--input-border); border-radius:4px;';
      abbrInput.dataset.index = index;
      abbrInput.dataset.field = 'abbreviation';
      abbrInput.onchange = updateEraField;
      eraRow.appendChild(abbrInput);
      
      if (index > 0) {
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.style.cssText = 'padding:8px 12px; background:var(--danger); color:white; border:none; border-radius:4px;';
        deleteBtn.onclick = () => removeEra(index);
        eraRow.appendChild(deleteBtn);
      }
      
      erasContainer.appendChild(eraRow);
    });
  }

  // Add a new era
  function addEra() {
    timelineSettings.eras.push({ name: 'New Era', abbreviation: 'NE' });
    populateErasSection();
  }

  // Remove an era
  function removeEra(index) {
    if (confirm('Are you sure you want to remove this era? This may affect existing timeline events.')) {
      timelineSettings.eras.splice(index, 1);
      populateErasSection();
    }
  }

  // Update era field value
  function updateEraField() {
    const index = parseInt(this.dataset.index);
    const field = this.dataset.field;
    timelineSettings.eras[index][field] = this.value;
  }

  // Update months inputs based on the number of months
  function updateMonthsInputs() {
    const count = parseInt(numMonths.value) || 12;
    
    // Ensure we have the right number of month names
    while (timelineSettings.months.length > count) {
      timelineSettings.months.pop();
    }
    
    while (timelineSettings.months.length < count) {
      timelineSettings.months.push(`Month ${timelineSettings.months.length + 1}`);
    }
    
    // Ensure we have the right number of days per month
    while (timelineSettings.daysPerMonth.length > count) {
      timelineSettings.daysPerMonth.pop();
    }
    
    while (timelineSettings.daysPerMonth.length < count) {
      timelineSettings.daysPerMonth.push(30);
    }
    
    // Create input fields for each month
    monthsContainer.innerHTML = '';
    
    timelineSettings.months.forEach((month, index) => {
      const monthRow = document.createElement('div');
      monthRow.style.cssText = 'display:flex; gap:10px; margin-bottom:5px; align-items:center;';
      
      const monthLabel = document.createElement('div');
      monthLabel.textContent = `Month ${index + 1}:`;
      monthLabel.style.cssText = 'width:80px; color:var(--text);';
      monthRow.appendChild(monthLabel);
      
      const monthInput = document.createElement('input');
      monthInput.type = 'text';
      monthInput.value = month;
      monthInput.style.cssText = 'flex:1; padding:8px; background:var(--input-bg); color:var(--text); border:1px solid var(--input-border); border-radius:4px;';
      monthInput.dataset.index = index;
      monthInput.onchange = function() {
        timelineSettings.months[parseInt(this.dataset.index)] = this.value;
      };
      monthRow.appendChild(monthInput);
      
      monthsContainer.appendChild(monthRow);
    });
    
    // Also update month lengths
    updateMonthLengthsInputs();
  }

  // Update days inputs based on the number of days in a week
  function updateDaysInputs() {
    const count = parseInt(numDaysInWeek.value) || 7;
    
    // Ensure we have the right number of day names
    while (timelineSettings.daysInWeek.length > count) {
      timelineSettings.daysInWeek.pop();
    }
    
    while (timelineSettings.daysInWeek.length < count) {
      timelineSettings.daysInWeek.push(`Day ${timelineSettings.daysInWeek.length + 1}`);
    }
    
    // Create input fields for each day
    daysContainer.innerHTML = '';
    
    timelineSettings.daysInWeek.forEach((day, index) => {
      const dayRow = document.createElement('div');
      dayRow.style.cssText = 'display:flex; gap:10px; margin-bottom:5px; align-items:center;';
      
      const dayLabel = document.createElement('div');
      dayLabel.textContent = `Day ${index + 1}:`;
      dayLabel.style.cssText = 'width:80px; color:var(--text);';
      dayRow.appendChild(dayLabel);
      
      const dayInput = document.createElement('input');
      dayInput.type = 'text';
      dayInput.value = day;
      dayInput.style.cssText = 'flex:1; padding:8px; background:var(--input-bg); color:var(--text); border:1px solid var(--input-border); border-radius:4px;';
      dayInput.dataset.index = index;
      dayInput.onchange = function() {
        timelineSettings.daysInWeek[parseInt(this.dataset.index)] = this.value;
      };
      dayRow.appendChild(dayInput);
      
      daysContainer.appendChild(dayRow);
    });
  }

  // Update month lengths inputs
  function updateMonthLengthsInputs() {
    monthLengthsContainer.innerHTML = '';
    
    timelineSettings.months.forEach((month, index) => {
      const lengthRow = document.createElement('div');
      lengthRow.style.cssText = 'display:flex; gap:10px; margin-bottom:5px; align-items:center;';
      
      const monthName = document.createElement('div');
      monthName.textContent = month + ':';
      monthName.style.cssText = 'flex:1; color:var(--text);';
      lengthRow.appendChild(monthName);
      
      const lengthInput = document.createElement('input');
      lengthInput.type = 'number';
      lengthInput.min = '1';
      lengthInput.max = '100';
      lengthInput.value = timelineSettings.daysPerMonth[index];
      lengthInput.style.cssText = 'width:80px; padding:8px; background:var(--input-bg); color:var(--text); border:1px solid var(--input-border); border-radius:4px;';
      lengthInput.dataset.index = index;
      lengthInput.onchange = function() {
        timelineSettings.daysPerMonth[parseInt(this.dataset.index)] = parseInt(this.value);
      };
      lengthRow.appendChild(lengthInput);
      
      lengthRow.appendChild(document.createTextNode(' days'));
      
      monthLengthsContainer.appendChild(lengthRow);
    });
  }

  // Save timeline settings
  async function saveTimelineSettings(event) {
    event.preventDefault();
    
    if (currentNovelIndex < 0) return;
    
    // Save settings to the current novel
    novels[currentNovelIndex].timelineSettings = timelineSettings;
    
    // Save to IndexedDB
    await saveToIndexedDB('novels', 'novelsData', novels);
    
    // Update any dropdowns that depend on these settings
    populateEraDropdown();
    populateMonthDropdown();
    
    // Reload timeline events to reflect new settings
    loadTimelineEvents();
    
    // Close the modal
    closeTimelineSettings();
  }

  // Close the timeline settings modal
  function closeTimelineSettings() {
    timelineSettingsModal.style.display = 'none';
  }

  // Populate the era dropdown in the event form
  function populateEraDropdown() {
    eventEra.innerHTML = '';
    
    timelineSettings.eras.forEach(era => {
      const option = document.createElement('option');
      option.value = era.name;
      option.textContent = `${era.name} (${era.abbreviation})`;
      eventEra.appendChild(option);
    });
  }

  // Populate the month dropdown in the event form
  function populateMonthDropdown() {
    eventMonth.innerHTML = '';
    
    // Add empty option
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-- No Month --';
    eventMonth.appendChild(emptyOption);
    
    timelineSettings.months.forEach((month, index) => {
      const option = document.createElement('option');
      option.value = index + 1;
      option.textContent = month;
      eventMonth.appendChild(option);
    });
    
    // Update days limits based on selected month
    eventMonth.onchange = updateDaysLimit;
  }

  // Update the maximum allowed days based on selected month
  function updateDaysLimit() {
    const monthIndex = parseInt(eventMonth.value) - 1;
    
    if (monthIndex >= 0 && monthIndex < timelineSettings.daysPerMonth.length) {
      eventDay.max = timelineSettings.daysPerMonth[monthIndex];
    } else {
      eventDay.max = 31; // Default
    }
    
    // Ensure the current value doesn't exceed the max
    if (parseInt(eventDay.value) > parseInt(eventDay.max)) {
      eventDay.value = eventDay.max;
    }
  }
  
  // Function to export current chapter as a Word document
  function exportAsWord() {
    // First check if there's a current chapter to export
    if (currentNovelIndex < 0 || novels[currentNovelIndex].currentChapterIndex < 0) {
      alert('Please select a chapter to export.');
      return;
    }
    
    // Save the current chapter before exporting
    saveCurrentChapter();
    
    // Get the chapter data
    const novel = novels[currentNovelIndex];
    const chapter = novel.chapters[novel.currentChapterIndex];
    
    // Get the export button for updating its state
    const exportBtn = document.querySelector('#toggleExportBtn');
    const originalText = exportBtn.textContent;
    exportBtn.disabled = true;
    exportBtn.textContent = "Preparing...";
    
    try {
      // Use a simple approach - converting HTML to a file that Word can open
      // This is a bit of a hack, but works on modern Word/Office versions
      
      // Basic stylesheet for the Word document
      const style = `
        <style>
          body { font-family: Calibri, Arial, sans-serif; margin: 2cm; }
          h1 { font-size: 24pt; color: #333; }
          p { font-size: 11pt; line-height: 1.5; }
        </style>
      `;
      
      // Create the HTML content
      const htmlContent = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" 
              xmlns:w="urn:schemas-microsoft-com:office:word" 
              xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta charset="utf-8">
          <title>${chapter.title}</title>
          ${style}
        </head>
        <body>
          <h1>${chapter.title}</h1>
          ${chapter.content}
        </body>
        </html>
      `;
      
      // Convert the HTML content to a Blob
      const blob = new Blob(['\ufeff', htmlContent], {
        type: 'application/msword'
      });
      
      // Create a URL for the Blob
      const url = URL.createObjectURL(blob);
      
      // Create a link element to download the file
      const link = document.createElement('a');
      link.href = url;
      link.download = `${chapter.title.replace(/[/\\?%*:|"<>]/g, '-')}.doc`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      // Close the export menu
      document.getElementById('exportMenuItems').style.display = 'none';
      
    } catch (error) {
      console.error('Error exporting to Word:', error);
      alert('There was an error exporting to Word. Please try again later.');
    } finally {
      // Restore button state
      exportBtn.disabled = false;
      exportBtn.textContent = originalText;
    }
  }
  
  // Function to export current chapter as a PDF
  function exportAsPdf() {
    // First check if there's a current chapter to export
    if (currentNovelIndex < 0 || novels[currentNovelIndex].currentChapterIndex < 0) {
      alert('Please select a chapter to export.');
      return;
    }
    
    // Save the current chapter before exporting
    saveCurrentChapter();
    
    // Get the chapter data
    const novel = novels[currentNovelIndex];
    const chapter = novel.chapters[novel.currentChapterIndex];
    
    // Get the export button for updating its state
    const exportBtn = document.querySelector('#toggleExportBtn');
    const originalText = exportBtn.textContent;
    exportBtn.disabled = true;
    exportBtn.textContent = "Preparing...";
    
    try {
      // Basic stylesheet for the PDF document
      const style = `
        <style>
          body { font-family: 'Times New Roman', Times, serif; margin: 3cm; line-height: 1.5; }
          h1 { font-size: 24pt; color: #333; text-align: center; margin-bottom: 2cm; }
          p { font-size: 12pt; margin-bottom: 0.5cm; text-align: justify; }
        </style>
      `;
      
      // Create the HTML content
      const htmlContent = `
        <html>
        <head>
          <meta charset="utf-8">
          <title>${chapter.title}</title>
          ${style}
        </head>
        <body>
          <h1>${chapter.title}</h1>
          ${chapter.content}
        </body>
        </html>
      `;
      
      // Open a new window to print to PDF
      const printWindow = window.open('', '_blank');
      printWindow.document.write(htmlContent);
      printWindow.document.close();
      
      // Add a short delay to ensure content is loaded before printing
      setTimeout(() => {
        printWindow.print();
        // Close the window after print dialog is closed (this may not work in all browsers)
        printWindow.onafterprint = function() {
          printWindow.close();
        };
      }, 500);
      
      // Close the export menu
      document.getElementById('exportMenuItems').style.display = 'none';
      
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('There was an error exporting to PDF. Please try again later.');
    } finally {
      // Restore button state
      exportBtn.disabled = false;
      exportBtn.textContent = originalText;
    }
  }

  // Function to export current chapter as a text file
  function exportAsTxt() {
    // First check if there's a current chapter to export
    if (currentNovelIndex < 0 || novels[currentNovelIndex].currentChapterIndex < 0) {
      alert('Please select a chapter to export.');
      return;
    }
    
    // Save the current chapter before exporting
    saveCurrentChapter();
    
    // Get the chapter data
    const novel = novels[currentNovelIndex];
    const chapter = novel.chapters[novel.currentChapterIndex];
    
    // Get the export button for updating its state
    const exportBtn = document.querySelector('#toggleExportBtn');
    const originalText = exportBtn.textContent;
    exportBtn.disabled = true;
    exportBtn.textContent = "Preparing...";
    
    try {
      // Extract text content from HTML
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = chapter.content;
      const textContent = tempDiv.textContent || tempDiv.innerText;
      
      // Create the text content
      const txt = `${chapter.title}\n\n${textContent}`;
      
      // Convert the text content to a Blob
      const blob = new Blob([txt], { type: 'text/plain' });
      
      // Create a URL for the Blob
      const url = URL.createObjectURL(blob);
      
      // Create a link element to download the file
      const link = document.createElement('a');
      link.href = url;
      link.download = `${chapter.title.replace(/[/\\?%*:|"<>]/g, '-')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      // Close the export menu
      document.getElementById('exportMenuItems').style.display = 'none';
      
    } catch (error) {
      console.error('Error exporting to text:', error);
      alert('There was an error exporting to text. Please try again later.');
    } finally {
      // Restore button state
      exportBtn.disabled = false;
      exportBtn.textContent = originalText;
    }
  }

  // Toggle the export menu
  function toggleExportMenu() {
    const menuItems = document.getElementById('exportMenuItems');
    menuItems.style.display = menuItems.style.display === 'none' ? 'block' : 'none';
    
    // Add a click event listener to close the menu when clicking outside
    if (menuItems.style.display === 'block') {
      setTimeout(() => {
        document.addEventListener('click', closeExportMenuOutside);
      }, 0);
    } else {
      document.removeEventListener('click', closeExportMenuOutside);
    }
  }

  // Close the export menu when clicking outside
  function closeExportMenuOutside(event) {
    const menuItems = document.getElementById('exportMenuItems');
    const exportBtn = event.target.closest('#toggleExportBtn');
    
    if (!exportBtn && !menuItems.contains(event.target)) {
      menuItems.style.display = 'none';
      document.removeEventListener('click', closeExportMenuOutside);
    }
  }
  
  // Handle window resize
  window.addEventListener('resize', updateMobileUI);
  
  // Close modals when clicking outside
  window.addEventListener('click', function(e) {
    if (e.target === imageModal) {
      closeImageModal();
    }
    if (e.target === specialCharModal) {
      closeSpecialCharModal();
    }
    if (e.target === characterImagePreviewModal) {
      closeImagePreviewModal();
    }
    if (e.target === loreImagePreviewModal) {
      closeLoreImagePreviewModal();
    }
    if (e.target === summaryModal) {
      closeSummaryModal();
    }
    if (e.target === textColorModal) {
      closeTextColorModal();
    }
    if (e.target === bgColorModal) {
      closeBgColorModal();
    }
    if (e.target === timerModal) {
      closeTimerModal();
    }
    if (e.target === timelineEventModal) {
      closeTimelineEventModal();
    }
    if (e.target === timelineSettingsModal) {
      closeTimelineSettings();
    }
  });
  
  // Initialize on load
  window.onload = init;
