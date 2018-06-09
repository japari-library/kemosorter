/** @type {CharData} */
let characterData = [];   // Initial character data set used.
/** @type {CharData} */
let characterDataToSort = [];   // Character data set after filtering.
/** @type {Options} */
let options = [];   // Initial option set used.

/** @type {(boolean|boolean[])[]} */
let optTaken = [];             // Records which options are set.

/** Save Data */
let timestamp = 0;        // (Unix time when sorter was started, used as initial PRNG seed and in dataset selection)
let timeTaken = 0;        // (Number of ms elapsed when sorter ends, used as end-of-sort flag and in filename generation)
let choices = '';       // (String of '0', '1' and '2' that records what sorter choices are made)
let timeError = false;    // Shifts entire savedata array to the right by 1 and adds an empty element at savedata[0] if true (:wao: What's this?).

/** Intermediate sorter data. */
let sortedIndexList = [];
let recordDataList = [];
let parentIndexList = [];
let tiedDataList = [];

let leftIndex = 0;
let leftInnerIndex = 0;
let rightIndex = 0;
let rightInnerIndex = 0;
let battleNo = 1;
let sortedNo = 0;
let pointer = 0;

/** A copy of intermediate sorter data is recorded for undo() purposes. */
let sortedIndexListPrev = [];
let recordDataListPrev = [];
let parentIndexListPrev = [];
let tiedDataListPrev = [];

let leftIndexPrev = 0;
let leftInnerIndexPrev = 0;
let rightIndexPrev = 0;
let rightInnerIndexPrev = 0;
let battleNoPrev = 1;
let sortedNoPrev = 0;
let pointerPrev = 0;

/** Miscellaneous sorter data that doesn't need to be saved for undo(). */
let finalCharacters = [];
let loading = false;
let totalBattles = 0;
let sorterURL = window.location.host + window.location.pathname;
let storedSaveType = localStorage.getItem(`${sorterURL}_saveType`);

/** Temporary data */
let results = [];

let japariWikiURL = 'https://japari-library.com/wiki';
let sorterDataSource = 'https://kemosorter.now.sh';
// let sorterDataSource = 'http://192.168.0.124:5000';
let hardMode = false;

function init() {
    retrieveSorterData()
    .then(() => {
        // Set-up Options
        populateOptions();

        // Set-up Sorter Buttons
        $('.sort-left .pick').click(() => { pick('left') });
        $('.sort-right .pick').click(() => { pick('right') });

        $('.sort-tie').click(() => { pick("tie") });
        $('.sort-undo').click(undo);

        $('.sort-save').click(() => { saveProgress("Progress") });
        $('.sort-load').click(loadProgress);

        $('#sorter-results-create').click(uploadResults);

        // Setup Keyboard Shortcuts
        $(document).keyup(evt => {
            switch(evt.key) {
                // case 's': case '3':                   saveProgress('Progress'); break;
                case 'ArrowLeft':           pick('left'); break;
                case 'ArrowRight':          pick('right'); break;
                case 'ArrowUp':             pick('tie'); break;
                case 'ArrowDown':           undo(); break;
                default: break;
            }
        });

        // Shortcuts/Event Handling
        $('#setting-hard').change((evt) => {
            let $selector = $('.sort-tie, .sort-undo');
            hardMode = $(evt.target).is(':checked');

            if (hardMode) {
                $selector.attr('disabled', 'disabled');
            } else {
                $selector.removeAttr('disabled');
            }
        });

        $('#setting-hard').change();
        
        // Select All Options
        $('#cb-option-select-all').change((evt) => {
            let bool = $(evt.target).is(':checked');
            $('.option input').prop('checked', bool);
        });

        /** Decode query string if available. */
        if (window.location.search.slice(1) !== '') {
            decodeQuery();
        }
    })
    .done(() => {
        $('.sorter-loading').hide();
        $('.sorter').show();
    })
    .fail((err) => {
        console.error(err.responseText);
        $('.message-container').append(message('Unable to load Kemono Friends Sorter', 'danger'));
    });
}

function start(characters = null) {

    // Clear messages
    $('.message-container').empty();

    /** Check selected options and convert to boolean array form. */
    optTaken = [];

    $('.option input:checked').each((idx, element) => {
        if($(element).attr('id') != 'cb-option-select-all') {
            optTaken.push($(element).val());
        }
    });

    /** Convert boolean array form to string form. */

    characterDataToSort = characterData.filter(char => {
        return char.categories.some(category => optTaken.includes(category._id));
    });

    if (characterDataToSort.length < 2) {
        $('.message-container').append(message('Cannot sort with less than two characters. Please reselect.', 'danger'));
        return;
    }

    /** Shuffle character array with timestamp seed. */
    timestamp = timestamp || new Date().getTime();
    // if (new Date(timestamp) < new Date(currentVersion)) { timeError = true; }
    Math.seedrandom(timestamp);

    if(characters) {
        characterDataToSort = characters;
    } else {
        characterDataToSort = characterDataToSort
            .map(a => [Math.random(), a])
            .sort((a, b) => a[0] - b[0])
            .map(a => a[1]);
    }

    /**
     * tiedDataList will keep a record of indexes on which characters are equal (i.e. tied) 
     * to another one. recordDataList will have an interim list of sorted elements during
     * the mergesort process.
     */

    recordDataList = characterDataToSort.map(() => 0);
    tiedDataList = characterDataToSort.map(() => -1);

    /** 
     * Put a list of indexes that we'll be sorting into sortedIndexList. These will refer back
     * to characterDataToSort.
     * 
     * Begin splitting each element into little arrays and spread them out over sortedIndexList
     * increasing its length until it become arrays of length 1 and you can't split it anymore. 
     * 
     * parentIndexList indicates each element's parent (i.e. where it was split from), except 
     * for the first element, which has no parent.
     */

    sortedIndexList[0] = characterDataToSort.map((val, idx) => idx);
    parentIndexList[0] = -1;

    let midpoint = 0;   // Indicates where to split the array.
    let marker = 1;   // Indicates where to place our newly split array.

    for (let i = 0; i < sortedIndexList.length; i++) {
        if (sortedIndexList[i].length > 1) {
            let parent = sortedIndexList[i];
            midpoint = Math.ceil(parent.length / 2);

            sortedIndexList[marker] = parent.slice(0, midpoint);              // Split the array in half, and put the left half into the marked index.
            totalBattles += sortedIndexList[marker].length;                   // The result's length will add to our total number of comparisons.
            parentIndexList[marker] = i;                                      // Record where it came from.
            marker++;                                                         // Increment the marker to put the right half into.

            sortedIndexList[marker] = parent.slice(midpoint, parent.length);  // Put the right half next to its left half.
            totalBattles += sortedIndexList[marker].length;                   // The result's length will add to our total number of comparisons.
            parentIndexList[marker] = i;                                      // Record where it came from.
            marker++;                                                         // Rinse and repeat, until we get arrays of length 1. This is initialization of merge sort.
        }
    }

    leftIndex = sortedIndexList.length - 2;    // Start with the second last value and...
    rightIndex = sortedIndexList.length - 1;    // the last value in the sorted list and work our way down to index 0.

    leftInnerIndex = 0;                        // Inner indexes, because we'll be comparing the left array
    rightInnerIndex = 0;                        // to the right array, in order to merge them into one sorted array.

    // Disable all checkboxes
    $('input[type="checkbox"]').attr('disabled', 'disabled');

    /** Disable all checkboxes and hide/show appropriate parts while we preload the images. */
    loading = true;
    
    preloadImages().then(() => {
        loading = false;
        display();
    });
}

/** Displays the current state of the sorter. */
function display() {
    const percent = Math.floor(sortedNo * 100 / totalBattles);
    const leftCharIndex = sortedIndexList[leftIndex][leftInnerIndex];
    const rightCharIndex = sortedIndexList[rightIndex][rightInnerIndex];
    const leftChar = characterDataToSort[leftCharIndex];
    const rightChar = characterDataToSort[rightCharIndex];

    progressBar(`Battle No. ${battleNo}`, percent);

    $('.sort-left img').attr('src', leftChar.image);
    $('.sort-right img').attr('src', rightChar.image);

    $('.sort-left p').text(leftChar.name);
    $('.sort-right p').text(rightChar.name);

    $('.sort-left a').attr('href', getJapariLibraryEntry(leftChar.name));
    $('.sort-right a').attr('href', getJapariLibraryEntry(rightChar.name));

    /** Autopick if choice has been given. */
    if (choices.length !== battleNo - 1) {
        switch (Number(choices[battleNo - 1])) {
            case 0: pick('left'); break;
            case 1: pick('right'); break;
            case 2: pick('tie'); break;
            default: break;
        }
    } else { saveProgress('Autosave'); }
}

/**
 * Shows the result of the sorter.
 * 
 * @param {number} [imageNum=10] Number of images to display. Defaults to 10.
 */
function result(imageNum = 10) {
    let rankNum = 1;
    let tiedRankNum = 1;

    const finalSortedIndexes = sortedIndexList[0].slice(0);

    characterDataToSort.forEach((val, idx) => {
        const characterIndex = finalSortedIndexes[idx];
        const character = characterDataToSort[characterIndex];

        let ranking = {
            rank: rankNum,
            character: character
        }

        finalCharacters.push(ranking);

        if (idx < characterDataToSort.length - 1) {
            if (tiedDataList[characterIndex] === finalSortedIndexes[idx + 1]) {
              tiedRankNum++;            // Indicates how many people are tied at the same rank.
            } else {
              rankNum += tiedRankNum;   // Add it to the actual ranking, then reset it.
              tiedRankNum = 1;          // The default value is 1, so it increments as normal if no ties.
            }
        }
    });

    let result = {
        timestamp: timestamp,
        duration: timeTaken,
        ranking: finalCharacters
    }

    displayResult(result);
}

function displayResult(result) {
    results = result;
    // Template
    // <table class="table table-bordered text-center">
    //     <thead class="thead-dark">
    //         <tr>
    //             <th scope="col" width="10%">Rank</th>
    //             <th scope="col" width="90%">Name</th>
    //         </tr>
    //     </thead>
    //     <tbody>
    //         <!-- To be filled -->
    //     </tbody>
    // </table>

    const IMAGE_NUM = 10; // Display only top 10 friends images
    const ROWS_PER_TABLE = 50; // Display 50 friends per table (Excluding 10 friends)

    // let table = $.templates('<table class="table table-bordered text-center"><thead class="thead-dark"><tr><th scope="col" width="10%">Rank</th><th scope="col" width="90%">Name</th></tr></thead><tbody></tbody></table>');
    let table = $.templates('<table class="table table-bordered text-center"><tbody></tbody></table>');
    let trCharImage = $.templates('<tr><td class="align-middle">{{:order}}</td><td class="align-middle"><img src="{{:image}}" class="img-fluid"><p class="lead"><a href="{{:url}}" target="_blank" class="text-dark">{{:name}}</a></p></td></tr>');
    let trChar = $.templates('<tr><td class="align-middle">{{:order}}</td><td class="align-middle"><p class="lead"><a href="{{:url}}" target="_blank" class="text-dark">{{:name}}</a></p></td></tr>');
    let resultsInfo = `This sorter was completed on ${new Date(result.timestamp + result.duration).toString()} and took ${msToReadableTime(result.duration)}`;

    let $container = $('.sorter-results-content');
    let $info = $('#sorter-results-info');
    let $table = null;
    let imgCount = IMAGE_NUM;
    let count = 0;

    $container.empty(); // Clear everything inside the results container
    $info.text(resultsInfo);

    result.ranking.forEach((rank, idx) => {
        if(idx == IMAGE_NUM / 2 || idx == IMAGE_NUM || ++count >= ROWS_PER_TABLE || $table == null) {
            $table = $(table.render());
            $container.append($table);

            count = 0;
        }

        let character = rank.character;

        if(!character) {
            character = {
                name: 'Missing No.',
                image: 'https://vignette.wikia.nocookie.net/joke-battles/images/d/d8/MissingNo..png/revision/latest?cb=20160129051405',
                url: japariWikiURL
            };
        }

        if (imgCount-- > 0) {
            $table.append(trCharImage.render({
                order: rank.rank,
                name: character.name,
                image: character.image,
                url: getJapariLibraryEntry(character.name)
            }));
        } else {
            $table.append(trChar.render({
                order: rank.rank,
                name: character.name,
                url: getJapariLibraryEntry(character.name)
            }));
        }
    });
    
    // result.ranking.forEach((rank, idx) => {
    //     if($table == null || ++count >= ROWS_PER_TABLE) {
    //         $table = $(table.render());
    //         $container.append($table);
            
    //         count = 0;
    //     }

    //     let character = rank.character;

    //     if(!character) {
    //         character = {
    //             name: 'Missing No.',
    //             image: 'https://vignette.wikia.nocookie.net/joke-battles/images/d/d8/MissingNo..png/revision/latest?cb=20160129051405',
    //             url: japariWikiURL
    //         };
    //     }

    //     $table.append(trCharImage.render({
    //         order: rank.rank,
    //         name: character.name,
    //         image: character.image,
    //         url: getJapariLibraryEntry(character.name)
    //     }));
    // });

    // var maxHeight = 0;

    // $('td').each(function() {
    //     maxHeight = ($(this).height() > maxHeight ? $(this).height() : maxHeight); 
    // })

    // $('td').height(maxHeight);

    $('.sorter').hide();
    $('.sorter-results').show();
}

function uploadResults() {
    let tmp = finalCharacters.map(rank => { return { rank: rank.rank, character: rank.character._id }});
    let payload = {
        timestamp: timestamp,
        duration: timeTaken,
        ranking: tmp
    }

    let $display = $('#sorter-results-url');

    if($display.val() == '') {
        $.post(`${sorterDataSource}/api/result`, { result: JSON.stringify(payload) })
            .done(resp => {
                $('#sorter-results-url').val(`${location.protocol}//${sorterURL}results?id=${resp.name}`);
            })
            .fail(err => {
                $('.message-container').append(message('Unable to create sharable results link, please try again', 'danger'));
            });
    } else {
        let url = $display.val();
        $('.message-container').append(message(`Sharable Results already created, please use this link <a href="${url}" class="alert-link">${url}</a>`, 'warning'));
    }
}

/**
 * Sort between two character choices or tie.
 * 
 * @param {'left'|'right'|'tie'} sortType
 */
function pick(sortType) {
    if ((timeTaken && choices.length === battleNo - 1) || loading || (sortType == 'tie' && hardMode) ) { return; }
    else if (!timestamp) { return start(); }

    sortedIndexListPrev = sortedIndexList.slice(0);
    recordDataListPrev = recordDataList.slice(0);
    parentIndexListPrev = parentIndexList.slice(0);
    tiedDataListPrev = tiedDataList.slice(0);

    leftIndexPrev = leftIndex;
    leftInnerIndexPrev = leftInnerIndex;
    rightIndexPrev = rightIndex;
    rightInnerIndexPrev = rightInnerIndex;
    battleNoPrev = battleNo;
    sortedNoPrev = sortedNo;
    pointerPrev = pointer;

    /** 
     * For picking 'left' or 'right':
     * 
     * Input the selected character's index into recordDataList. Increment the pointer of
     * recordDataList. Then, check if there are any ties with this character, and keep
     * incrementing until we find no more ties. 
     */
    switch (sortType) {
        case 'left': {
            if (choices.length === battleNo - 1) { choices += '0'; }
            recordData('left');
            while (tiedDataList[recordDataList[pointer - 1]] != -1) {
                recordData('left');
            }
            break;
        }
        case 'right': {
            if (choices.length === battleNo - 1) { choices += '1'; }
            recordData('right');
            while (tiedDataList[recordDataList[pointer - 1]] != -1) {
                recordData('right');
            }
            break;
        }

        /** 
         * For picking 'tie' (i.e. heretics):
         * 
         * Proceed as if we picked the 'left' character. Then, we record the right character's
         * index value into the list of ties (at the left character's index) and then proceed
         * as if we picked the 'right' character.
         */
        case 'tie': {
            if (choices.length === battleNo - 1) { choices += '2'; }
            recordData('left');
            while (tiedDataList[recordDataList[pointer - 1]] != -1) {
                recordData('left');
            }
            tiedDataList[recordDataList[pointer - 1]] = sortedIndexList[rightIndex][rightInnerIndex];
            recordData('right');
            while (tiedDataList[recordDataList[pointer - 1]] != -1) {
                recordData('right');
            }
            break;
        }
        default: return;
    }

    /**
     * Once we reach the limit of the 'right' character list, we 
     * insert all of the 'left' characters into the record, or vice versa.
     */
    const leftListLen = sortedIndexList[leftIndex].length;
    const rightListLen = sortedIndexList[rightIndex].length;

    if (leftInnerIndex < leftListLen && rightInnerIndex === rightListLen) {
        while (leftInnerIndex < leftListLen) {
            recordData('left');
        }
    } else if (leftInnerIndex === leftListLen && rightInnerIndex < rightListLen) {
        while (rightInnerIndex < rightListLen) {
            recordData('right');
        }
    }

    /**
     * Once we reach the end of both 'left' and 'right' character lists, we can remove 
     * the arrays from the initial mergesort array, since they are now recorded. This
     * record is a sorted version of both lists, so we can replace their original 
     * (unsorted) parent with a sorted version. Purge the record afterwards.
     */
    if (leftInnerIndex === leftListLen && rightInnerIndex === rightListLen) {
        for (let i = 0; i < leftListLen + rightListLen; i++) {
            sortedIndexList[parentIndexList[leftIndex]][i] = recordDataList[i];
        }
        sortedIndexList.pop();
        sortedIndexList.pop();
        leftIndex = leftIndex - 2;
        rightIndex = rightIndex - 2;
        leftInnerIndex = 0;
        rightInnerIndex = 0;

        sortedIndexList.forEach((val, idx) => recordDataList[idx] = 0);
        pointer = 0;
    }

    /**
     * If, after shifting the 'left' index on the sorted list, we reach past the beginning
     * of the sorted array, that means the entire array is now sorted. The original unsorted
     * array in index 0 is now replaced with a sorted version, and we will now output this.
     */
    if (leftIndex < 0) {
        timeTaken = timeTaken || new Date().getTime() - timestamp;

        progressBar(`Battle No. ${battleNo} - Completed!`, 100);

        result();
        uploadResults();
    } else {
        battleNo++;
        display();
    }
}

/**
 * Records data in recordDataList.
 * 
 * @param {'left'|'right'} sortType Record from the left or the right character array.
 */
function recordData(sortType) {
    if (sortType === 'left') {
        recordDataList[pointer] = sortedIndexList[leftIndex][leftInnerIndex];
        leftInnerIndex++;
    } else {
        recordDataList[pointer] = sortedIndexList[rightIndex][rightInnerIndex];
        rightInnerIndex++;
    }

    pointer++;
    sortedNo++;
}

/** Undo previous choice. */
function undo() {
    if (timeTaken || hardMode) { return; }

    choices = battleNo === battleNoPrev ? choices : choices.slice(0, -1);

    sortedIndexList = sortedIndexListPrev.slice(0);
    recordDataList = recordDataListPrev.slice(0);
    parentIndexList = parentIndexListPrev.slice(0);
    tiedDataList = tiedDataListPrev.slice(0);

    leftIndex = leftIndexPrev;
    leftInnerIndex = leftInnerIndexPrev;
    rightIndex = rightIndexPrev;
    rightInnerIndex = rightInnerIndexPrev;
    battleNo = battleNoPrev;
    sortedNo = sortedNoPrev;
    pointer = pointerPrev;

    display();
}

/** 
 * Save progress to local browser storage.
 * 
 * @param {'Autosave'|'Progress'|'Last Result'} saveType
*/
function saveProgress(saveType) {
    if(timestamp == 0) { return; }

    const saveData = generateSaveData();
  
    localStorage.setItem(`${sorterURL}_saveData`, LZString.compressToEncodedURIComponent(JSON.stringify(saveData)));
    localStorage.setItem(`${sorterURL}_saveType`, saveType);
  
    if (saveType !== 'Autosave') {

        $('.message-container').append(message(`Uploading save.. it may take a while`, 'info'));

        $.post(`${sorterDataSource}/api/save`, { save: JSON.stringify(saveData) }).then(resp => {
            const saveURL = `${location.protocol}//${sorterURL}?${resp.name}`;

            $('.message-container').append(message(`
                Save successful! You may use this link to continue sorting: <a href="${saveURL}" class="alert-link">${resp.name}</a>
            `, 'success'));
        }).fail(err => {
            console.error(err.responseText);
            $('.message-container').append(message('Unable to save sorter progress online, you may still load the offline-copy of your save', 'danger'));
        });
    }
}

/**
 * Load progress from local browser storage.
*/
function loadProgress() {
    const saveData = localStorage.getItem(`${sorterURL}_saveData`);
    if (saveData) {
        const save = JSON.parse(LZString.decompressFromEncodedURIComponent(saveData));

        let corrupt = false;
        let tmp = [];

        save.characters.forEach((id, index) => {
            let character = characterData.find(char => char._id == id);

            if(character) {
                tmp.push(character);
            }
        });

        save.characters = tmp;
        loadSave(save);
    }
}

/**
 * Modifies the progress bar.
 * 
 * @param {string} indicator
 * @param {number} percentage
 */
function progressBar(indicator, percentage) {
    let $progress = $('.progress-bar');
    let $indicator = $('.sorter-progress');

    $indicator.text(indicator);
    $progress.css('width', `${percentage}%`);
    $progress.text(`${percentage}%`);
    $progress.attr('aria-valuenow', `${percentage}`);
}

function generateSaveData() {
    let save = {
        characters: characterDataToSort.map(char => { return char._id }),
        categories: optTaken,
        hardMode: hardMode,
        timestamp: timestamp,
        choices: choices
    }

    return save;
  }

function retrieveSorterResults() {
    let getParameterByName = name => {
        var match = RegExp('[?&]' + name + '=([^&]*)').exec(window.location.search);
        return match && decodeURIComponent(match[1].replace(/\+/g, ' '));
    }

    let code = getParameterByName('id') || null;
    let $error = message(`Unable to retrieve sorter results`, 'danger');

    $('.sorter-loading').show();
    // $('.sorter-loading').show();

    if(code) {
        $.get(`${sorterDataSource}/api/result/${code}`)
            .done(resp => { 
                if(resp) {
                    $('.sorter-loading').hide();
                    $('#sorter-results-link').attr('href', window.location.href);
                    $('#sorter-results-link').text(code);
                    displayResult(resp);
                } else {
                    $('.message-container').append($error);
                }
            })
            .fail(err => {
                console.error(err.responseText);
                $('.message-container').append($error);
            });
    } else {
        $('.message-container').append($error);
    }
}

function retrieveSorterData() {
    return $.when($.get(`${sorterDataSource}/api/character`), $.get(`${sorterDataSource}/api/category`)).then((characters, categories) => {
        characterData = characters[0];
        options  = categories[0];
        $('#character-count').text(characterData.length);
    });
}

/** Populate option list. */
function populateOptions() {
    /*
        <div class="custom-control custom-checkbox option">
            <input type="checkbox" class="custom-control-input" id="filter-all" checked>
            <label class="custom-control-label" for="filter-all">Select All</label>
        </div>
    */

    let $options = $('.sorter-options');
    let template = $.templates(`<div class="custom-control custom-checkbox option">
                                    <input type="checkbox" class="custom-control-input" id="cb-{{:_id}}" value="{{:_id}}" checked="checked">
                                    <label class="custom-control-label" for="cb-{{:_id}}">{{:name}}</label>
                                </div>`);

    $options.empty();
    $options.append(template.render({
        _id: 'option-select-all',
        name: 'Select All'
    }));

    options.forEach(option => {
        $options.append(template.render(option));
    });
}

/**
 * Decodes shareable link query string.
 * @param {string} queryString
 */
function decodeQuery(queryString = window.location.search.slice(1)) {
    const code = clean(queryString);
    const saveURL = `${location.protocol}//${sorterURL}?${code}`;

    $('.message-container').append(message(`Loading Online Save <a href="${saveURL}" class="alert-link">${code}</a>`, 'info'));

    let $error = message(`Unable to load save <a href="${saveURL}" class="alert-link">${code}</a>`, 'danger');

    return $.get(`${sorterDataSource}/api/save/${code}`)
        .done(resp => {
            if(resp) {
                loadSave(resp);
            } else {
                $('.message-container').append($error);
            }
        })
        .fail(err => {
            $('.message-container').append($error);
        });
}

function loadSave(save) {
    if(save) {
        characterDataToSort = save.characters;
        optTaken = save.categories;

        timestamp = save.timestamp;
        choices = save.choices;

        // Uncheck checkboxes not under optTaken
        $('.option input').prop('checked', false);

        optTaken.forEach(opt => {
            let id = opt._id || opt;
            $(`#cb-${id}`).prop('checked', true);
        });

        console.log(save);

        start(characterDataToSort);
    }
}

/** 
 * Preloads images in the filtered character data and converts to base64 representation.
*/
function preloadImages() {
    const totalLength = characterDataToSort.length;
    let imagesLoaded = 0;
  
    const loadImage = (src, idx) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
  
            img.crossOrigin = 'Anonymous';
            img.onload = () => {
              setImageToData(img, idx);
              resolve(img);
            };
            img.onerror = img.onabort = () => reject(src);
            if ( img.complete || img.complete === undefined ) {
              img.src = src;
            }
            img.src = src;
        });
    };
  
    const setImageToData = (img, idx) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        characterDataToSort[idx].image = canvas.toDataURL();

        progressBar(`Loading Image ${++imagesLoaded}`, Math.floor(imagesLoaded * 100 / totalLength));
    };
  
    const promises = characterDataToSort.map((char, idx) => loadImage(char.image, idx));
    return Promise.all(promises);
}

/**
 * Returns a readable time string from milliseconds.
 * 
 * @param {number} milliseconds
 */
function msToReadableTime(milliseconds) {
    let t = Math.floor(milliseconds / 1000);
    const years = Math.floor(t / 31536000);
    t = t - (years * 31536000);
    const months = Math.floor(t / 2592000);
    t = t - (months * 2592000);
    const days = Math.floor(t / 86400);
    t = t - (days * 86400);
    const hours = Math.floor(t / 3600);
    t = t - (hours * 3600);
    const minutes = Math.floor(t / 60);
    t = t - (minutes * 60);
    const content = [];
    if (years) content.push(years + " year" + (years > 1 ? "s" : ""));
    if (months) content.push(months + " month" + (months > 1 ? "s" : ""));
    if (days) content.push(days + " day" + (days > 1 ? "s" : ""));
    if (hours) content.push(hours + " hour" + (hours > 1 ? "s" : ""));
    if (minutes) content.push(minutes + " minute" + (minutes > 1 ? "s" : ""));
    if (t) content.push(t + " second" + (t > 1 ? "s" : ""));
    return content.slice(0, 3).join(', ');
}

/** 
 * Save progress to local browser storage.
 * @param {String} html
 * @param {'primary'|'secondary'|'success'|'danger'|'warning'|'info'|'light'|'dark'} type
*/
function message(html, type) {
    return $(`<div class="alert alert-${type} alert-dismissible fade show" role="alert">
                    ${html}
                    <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>`);
}

function clean(str) {
    return str.replace(/[^a-zA-Z ]/g, '');
}

/**
 * Returns a url to japari library entry for friend
 * 
 * @param {string} character
 */
function getJapariLibraryEntry(character) {
    let name = character.replace(' ', '_');
    return `${japariWikiURL}/${name}`;
}