// 2008/7/3 Scripted by K-Factory@migiwa
// 2008/7/19 Modified by  K-Factory@migiwa
// ・イラストのランダム化
// ・BugFix
// 2008/7/25 Modified by  K-Factory@migiwa
// ・ランキングにイラスト表示
// ・メンテナンス用PG追加
// ・BugFix
// 2009/1/27 Modified by  K-Factory@migiwa
// ・絵の表示ON/OFF追加
// ・高速化処理追加
// 2009/9/8 Modified by  K-Factory@migiwa
// ・タイトル分類の変更
// 2013/1/22 Modified by Anonymous
// added undo function (requires minor changes in index.html and fnc_data.js)

// 実行コードです。
// 修正する場合は気をつけてください。
var ary_TempData = new Array();
var ary_SortData = new Array();
var ary_ParentData = new Array();
var ary_EqualData = new Array();
var int_LeftList, int_LeftID;
var int_RightList, int_RightID;
var ary_RecordData = new Array();
var int_RecordID = 0;
var csort = new Array();
var csort2 = new Array();
var csort3 = new Array();
var csort4 = new Array();
var csort5 = new Array();
var csort6 = new Array();
var int_Count = 0;
var int_Total = 0;
var int_Completed = 0;
var int_Status = 0;
var sID = 'GaGprog';
var iGM = 100;
var hardMode = false;
var back_ary_SortData = new Array();
var back_ary_EqualData = new Array();
var back_ary_RecordData = new Array();
var back_int_RecordID = 0;
//var back_ary_TempData = new Array();
var back_ary_ParentData = new Array();

var back_int_Completed = 0;
var back_int_Total = 0;
var back_int_RightList = int_RightList;
var back_int_RightID = int_RightID;
var back_int_LeftList = int_LeftList;
var back_int_LeftID = int_LeftID;

// Sorter Server related variables
var sorter_results_url = "";
var server_url = "https://kemofuresorter.herokuapp.com";
// var server_url = "http://localhost:5000";

// *****************************************************************************
// * StartUp
// * <BODY>タグの読み込み終了時に実行。
function startup() {
    var tbl_Select = gID('optTable');
    var tbl_body_Select = cE('tbody');
    tbl_Select.appendChild(tbl_body_Select);
    document.addEventListener('keyup', (event) => {
        let keyName = event.keyCode;
        switch (keyName) {
            case 37:
                fnc_Sort(-1);
                break;
            case 39:
                fnc_Sort(1);
                break;
            case 38:
                fnc_Sort(0);
                break;
            case 40:
                fnc_Undo();
                break;
            default:
                break;
        }
    }, true)
    // タイトルから選択用チェックボックスに変換
    for (i = 0; i < ary_TitleData.length; i++) {
        // Row[i]
        if ((i % int_Colspan) == 0) {
            var new_row = tbl_body_Select.insertRow(tbl_body_Select.rows.length);
            new_row.id = 'optSelRow' + i;
        }
        // Col[0]
        var new_cell = new_row.insertCell(new_row.childNodes.length);
        var new_CheckBox = cE('input');
        new_CheckBox.setAttribute('type', 'checkbox', 0);
        new_CheckBox.setAttribute('checked', 'true', 0);
        new_CheckBox.value = ary_TitleData[i];
        new_CheckBox.title = ary_TitleData[i];
        new_CheckBox.id = 'optSelect' + i;
        new_cell.appendChild(new_CheckBox);

        var new_span = cE('span');
        new_span.appendChild(cT(ary_TitleData[i]));
        new_span.title = ary_TitleData[i];
        new_span.id = i;
        sC(new_span, 'cbox');
        new_span.onclick = function () {
            chgFlag(this.id);
        }
        new_cell.appendChild(new_span);
    }

    gID('optImage').disabled = false;

    var tbl_foot_Select = cE('tfoot');
    tbl_Select.appendChild(tbl_foot_Select);

    // Row[0]
    var new_row = tbl_foot_Select.insertRow(tbl_foot_Select.rows.length);
    sC(new_row, "opt_foot");

    var new_cell = new_row.insertCell(new_row.childNodes.length);
    new_cell.setAttribute('colspan', int_Colspan, 0);
    var new_CheckBox = cE('input');
    new_CheckBox.setAttribute('type', 'checkbox', 0);
    new_CheckBox.setAttribute('checked', 'true', 0);
    new_CheckBox.value = "All";
    new_CheckBox.title = "All boxes are checked/unchecked at the same time.";
    new_CheckBox.id = 'optSelect_all';
    new_CheckBox.onclick = function () {
        chgAll();
    }
    new_cell.appendChild(new_CheckBox);

    var new_span = cE('span');
    new_span.appendChild(cT("Select All"));
    new_cell.appendChild(new_span);
    let leftTxt = cE("p");
    leftTxt.id = "fldLeftText";
    leftTxt.textContent = fldDefaultText;
    gID("fldLeft").appendChild(leftTxt);
    let rightTxt = cE("p");
    rightTxt.id = "fldRightText";
    rightTxt.textContent = fldDefaultText;
    gID("fldRight").appendChild(rightTxt);
    if (!bln_ProgessBar) fCG(sID, iGM, iGM);
}

function chgAll() {
    for (i = 0; i < ary_TitleData.length; i++) {
        gID('optSelect' + i).checked = gID('optSelect_all').checked;
    }
}

// *****************************************************************************
// * chgFlag
// * タイトル名がクリックされてもチェックボックスを変更する。
function chgFlag(int_id) {
    var obj_Check = gID('optSelect' + int_id);
    if (!obj_Check.disabled) {
        obj_Check.checked = (obj_Check.checked) ? false : true;
    }
}

// *****************************************************************************
// * Initialize
// * 使用する配列や、カウンターを初期化する
// * 初回のみ動作。
function init() {
    int_Total = 0;
    int_RecordID = 0;

    // ソート対象のみを抽出
    for (i = 0; i < ary_CharacterData.length; i++) {
        for (j = 0; j < ary_TitleData.length; j++) {
            if (gID('optSelect' + j).checked && (ary_CharacterData[i][2][j] == 1)) {
                ary_TempData[int_Total] = ary_CharacterData[i];
                int_Total++;
                break;
            }
        }
    }
    gID("hardMode").disabled = true;
    gID("optImage").disabled = true;
    if (int_Total == 0) {
        alert("Please make a selection.");
        return;
    } else {
        for (i = 0; i < ary_TitleData.length; i++) {
            gID('optSelect' + i).disabled = true;
        }
        gID('optImage').disabled = true;
    }

    int_Total = 0;

    // ソート配列にIDを格納する
    ary_SortData[0] = new Array();
    for (i = 0; i < ary_TempData.length; i++) {
        ary_SortData[0][i] = i;

        // 保存用配列
        ary_RecordData[i] = 0;
    }

    var int_Pointer = 1;
    for (i = 0; i < ary_SortData.length; i++) {
        // #ソートは基本ロジックを流用
        // 要素数が２以上なら２分割し、
        // 分割された配列をary_SortDataの最後に加える
        if (ary_SortData[i].length >= 2) {
            var int_Marker = Math.ceil(ary_SortData[i].length / 2);
            ary_SortData[int_Pointer] = ary_SortData[i].slice(0, int_Marker);
            int_Total += ary_SortData[int_Pointer].length;
            ary_ParentData[int_Pointer] = i;
            int_Pointer++;

            ary_SortData[int_Pointer] = ary_SortData[i].slice(int_Marker, ary_SortData[i].length);
            int_Total += ary_SortData[int_Pointer].length;
            ary_ParentData[int_Pointer] = i;
            int_Pointer++;
        }
    }

    // 引き分けの結果を保存するリスト
    // キー：リンク始点の値
    // 値 ：リンク終点の値
    for (i = 0; i <= ary_TempData.length; i++) {
        ary_EqualData[i] = -1;
    }

    int_LeftList = ary_SortData.length - 2;
    int_RightList = ary_SortData.length - 1;
    int_LeftID = 0;
    int_RightID = 0;
    int_Count = 1;
    int_Completed = 0;

    sorter_results_url = "";

    // イニシャライズが終了したのでステータスを1に変更
    int_Status = 1;

    gID('fldMiddleT').innerHTML = str_CenterT;
    gID('fldMiddleB').innerHTML = str_CenterB;

    fnc_ShowData();
}

// *****************************************************************************
// * Image Initialize
// * メンテナンス用リスト
function imginit() {
    var int_ImgCount = 0;
    var int_ImgValue = 0;
    var int_ImgMax = 0;

    var tbl_Image_body = gID('imgTable');

    for (i = 0; i < ary_CharacterData.length; i++) {
        new_row = tbl_Image_body.insertRow(tbl_Image_body.rows.length);

        // Col[0]
        new_cell = new_row.insertCell(new_row.childNodes.length);
        new_cell.appendChild(cT(i));
        sC(new_cell, 'resTableL');

        // Col[1]
        new_cell = new_row.insertCell(new_row.childNodes.length);
        new_cell.appendChild(cT(ary_CharacterData[i][1]));
        sC(new_cell, 'resTableR');

        // Col[2]
        new_cell = new_row.insertCell(new_row.childNodes.length);
        for (j = 0; j < ary_TitleData.length; j++) {
            if (ary_CharacterData[i][2][j] == 1) {
                new_cell.appendChild(cT(ary_TitleData[j]));
                new_cell.appendChild(cE('br'));
            }
        }
        sC(new_cell, 'resTableR');

        // Col[3]
        new_cell = new_row.insertCell(new_row.childNodes.length);
        sC(new_cell, 'resTableR');

        if (ary_CharacterData[i][3].length > 0) {
            for (j = 3; j < ary_CharacterData[i].length; j++) {
                var new_img = cE('img');
                new_img.src = str_ImgPath + ary_CharacterData[i][j];
                new_cell.appendChild(new_img);
                int_ImgCount++;
            }
            int_ImgValue++;
        }
        int_ImgMax++;
    }

    gID("lbl_imgCount").innerHTML = int_ImgCount;
    gID("lbl_imgParcent").innerHTML = Math.floor((int_ImgValue / int_ImgMax) * 100);
    gID("lbl_imgValue").innerHTML = int_ImgValue;
    gID("lbl_imgMax").innerHTML = int_ImgMax;
}

// Undo previous choice (

function fnc_Undo() {
    if (int_Status == 0) {
        fnc_Sort(0);
        return;
    }

    if (int_Count > 2 && int_Completed != back_int_Completed) {

        //ary_TempData = back_ary_TempData.slice(0);
        ary_SortData = back_ary_SortData.slice(0);
        ary_RecordData = back_ary_RecordData.slice(0);
        int_RecordID = back_int_RecordID;
        ary_EqualData = back_ary_EqualData.slice(0);
        ary_ParentData = back_ary_ParentData.slice(0);

        int_Completed = back_int_Completed;
        int_Count = int_Count - 2;
        int_Total = back_int_Total;
        int_RightList = back_int_RightList;
        int_RightID = back_int_RightID;
        int_LeftList = back_int_LeftList;
        int_LeftID = back_int_LeftID;
        int_Status = (int_LeftList < 0) ? 2 : 1;

        fnc_ShowData();
    }
}

/* Debugging purposes (simulates choosing Tie until completion)

function fnc_TieRest(){
	while(int_Status < 2){
		fnc_Sort(0);
	}
}
*/

// *****************************************************************************
// * Sort (-1:左側, 0:引き分け, 1:右側)

function fnc_Sort(int_SelectID) {

    //back_ary_TempData = ary_TempData.slice(0);	
    back_ary_SortData = ary_SortData.slice(0);
    back_ary_RecordData = ary_RecordData.slice(0);
    back_int_RecordID = int_RecordID;
    back_ary_EqualData = ary_EqualData.slice(0);
    back_ary_ParentData = ary_ParentData.slice(0);

    back_int_Completed = int_Completed;
    back_int_Total = int_Total;
    back_int_RightList = int_RightList;
    back_int_RightID = int_RightID;
    back_int_LeftList = int_LeftList;
    back_int_LeftID = int_LeftID;

    // ステータスにより処理を分岐
    switch (int_Status) {
        case 0:
            // 初回クリック時、ソート情報を初期化する。
            init();
        case 2:
            // ソートが終了していた場合、ソート処理は行わない。
            return;
        default:
    }

    // ary_RecordDataに保存
    // 左側Count
    if (int_SelectID != 1) {
        fnc_CountUp(0);
        while (ary_EqualData[ary_RecordData[int_RecordID - 1]] != -1) {
            fnc_CountUp(0);
        }
    }

    // 引き分けの場合のみ
    if (int_SelectID == 0) {
        ary_EqualData[ary_RecordData[int_RecordID - 1]] = ary_SortData[int_RightList][int_RightID];
    }

    // 右側Count
    if (int_SelectID != -1) {
        fnc_CountUp(1);
        while (ary_EqualData[ary_RecordData[int_RecordID - 1]] != -1) {
            fnc_CountUp(1);
        }
    }

    // 片方のリストを走査し終えた後の処理
    if (int_LeftID < ary_SortData[int_LeftList].length && int_RightID == ary_SortData[int_RightList].length) {
        // リストint_RightListが走査済 - リストint_LeftListの残りをコピー
        while (int_LeftID < ary_SortData[int_LeftList].length) {
            fnc_CountUp(0);
        }
    } else if (int_LeftID == ary_SortData[int_LeftList].length && int_RightID < ary_SortData[int_RightList].length) {
        // リストint_LeftListが走査済 - リストint_RightListの残りをコピー
        while (int_RightID < ary_SortData[int_RightList].length) {
            fnc_CountUp(1);
        }
    }

    //両方のリストの最後に到達した場合は
    //親リストを更新する
    if (int_LeftID == ary_SortData[int_LeftList].length && int_RightID == ary_SortData[int_RightList].length) {
        for (i = 0; i < ary_SortData[int_LeftList].length + ary_SortData[int_RightList].length; i++) {
            ary_SortData[ary_ParentData[int_LeftList]][i] = ary_RecordData[i];
        }

        ary_SortData.pop();
        ary_SortData.pop();
        int_LeftList = int_LeftList - 2;
        int_RightList = int_RightList - 2;
        int_LeftID = 0;
        int_RightID = 0;

        //新しい比較を行う前にary_RecordDataを初期化
        if (int_LeftID == 0 && int_RightID == 0) {
            for (i = 0; i < ary_TempData.length; i++) {
                ary_RecordData[i] = 0;
            }
            int_RecordID = 0;
        }
    }

    // 終了チェック
    int_Status = (int_LeftList < 0) ? 2 : 1;

    fnc_ShowData();
}

// *****************************************************************************
// * CountUp(0:左側 1:右側)
// * 選択された方をカウントアップする。
function fnc_CountUp(int_Select) {
    ary_RecordData[int_RecordID] = ary_SortData[((int_Select == 0) ? int_LeftList : int_RightList)][((int_Select == 0) ? int_LeftID : int_RightID)];

    if (int_Select == 0) {
        int_LeftID++;
    } else {
        int_RightID++;
    }

    int_RecordID++;
    int_Completed++;
}

// *****************************************************************************
// * ShowData
// * é€²æ—çŽ‡ã¨åå‰ã‚’è¡¨ç¤ºã™ã‚‹ã€‚
function fnc_ShowData() {



    gID("lblCount").innerHTML = int_Count;
    gID("lblProgress").innerHTML = Math.floor(int_Completed * 100 / int_Total);
    if (!bln_ProgessBar) eGR(sID, Math.floor(int_Completed * 100 / int_Total));
    if (hardMode) {
        gID("hardMode").checked = true;
        document.getElementsByClassName("undoButton")[0].style.display = "none";
        document.getElementsByClassName("tieButton")[0].style.display = "none";
    }
    if (int_Status == 2) {
        // åˆ¤å®šãŒçµ‚äº†ã—ã¦ã„ãŸå ´åˆã€çµæžœè¡¨ç¤ºã€‚
        var int_Result = 1;

        var tbl_Result = cE('table');
        tbl_Result.classList.add('resTable');

        var tbl_head_Result = cE('thead');
        tbl_Result.appendChild(tbl_head_Result);

        new_row = tbl_head_Result.insertRow(tbl_head_Result.rows.length);

        // Col[0]
        new_cell = new_row.insertCell(new_row.childNodes.length);
        sC(new_cell, 'resTableH');
        new_cell.appendChild(cT('Order'));
        // Col[1]
        new_cell = new_row.insertCell(new_row.childNodes.length);
        sC(new_cell, 'resTableH');
        new_cell.appendChild(cT('Name'));

        var tbl_body_Result = cE('tbody');
        tbl_Result.appendChild(tbl_body_Result);

        var int_Same = 1;

        var obj_SelectItem = gID("resultField");
        obj_SelectItem.innerHTML = "";
        obj_SelectItem.appendChild(tbl_Result);

        for (i = 0; i < ary_TempData.length; i++) {
            var rowId = i;
            new_row = tbl_body_Result.insertRow(tbl_body_Result.rows.length);

            // Col[0]
            new_cell = new_row.insertCell(new_row.childNodes.length);
            sC(new_cell, 'resTableL');
            new_cell.appendChild(cT(i + 1));

            csort2[i] = int_Result; // v2a

            // Col[1]
            new_cell = new_row.insertCell(new_row.childNodes.length);
            sC(new_cell, 'resTableR');

            var bln_imgFlag = false;
            if ((int_ResultImg != 0) && (i < int_ResultRank)) {
                var new_img = cE('img');
                var obj_TempData = ary_TempData[ary_SortData[0][i]];
                if (obj_TempData[3].length > 0) {
                    new_img.src = str_ImgPath + obj_TempData[3];
                    new_img.style.height = "174px"; // hacky scaling fix
                    new_cell.appendChild(new_img);
                    new_cell.appendChild(cE('br'));
                    bln_imgFlag = true;
                }
            }

            if ((int_ResultImg == 2) || (!bln_imgFlag)) {
                new_cell.appendChild(cT(ary_TempData[ary_SortData[0][i]][1]));
                csort4[i] = ary_TempData[ary_SortData[0][i]][1]; // v2a
                csort6[i] = ary_TempData[ary_SortData[0][i]][1]; // v2a
            }

            if (i < ary_TempData.length - 1) {
                if (bln_ResultMode == 0) {
                    if (ary_EqualData[ary_SortData[0][i]] == ary_SortData[0][i + 1]) {
                        int_Result++;
                    }
                } else {
                    if (ary_EqualData[ary_SortData[0][i]] == ary_SortData[0][i + 1]) {
                        int_Same++;
                    } else {
                        int_Result += int_Same;
                        int_Same = 1;
                    }
                }
            }

            // Break up results into a new table after every [maxRows] results,
            // or at the transition point between image and imageless results.
            // Do not break in the middle of image results. Dynamically change
            // row number based on number of images displayed.

            if (int_ResultRank > 5) {
                var maxRows = 56;
                var cutoff = rowId > 5 ? maxRows - (int_ResultRank * 10 + 2) : 4;
            } else if (int_ResultRank > 3) {
                var maxRows = int_ResultRank * 11 + 1;
                var cutoff = int_ResultRank - 1;
            } else {
                var maxRows = 41;
                var cutoff = maxRows - (int_ResultRank * 10 + 2);
            }

            if (rowId >= cutoff &&
                rowId == cutoff ||
                (rowId - cutoff) % maxRows == 0) {

                tbl_Result = cE('table');
                tbl_Result.classList.add('resTable');
                tbl_body_Result = cE('tbody');
                tbl_Result.appendChild(tbl_body_Result);
                obj_SelectItem.appendChild(tbl_Result);
                var obj_SelectItem = gID("resultField");
            }
        }


        if (bln_ResultStyle == 1) {
            gID("mainTable").style.display = 'none';
        }
        if (bln_ResultStyle == 0) {
            gID("ranTable").style.display = 'inline';
        } // v2a

        // v2a start

        for (i = 0; i < 10; i++) {
            if (csort4[i] == undefined) {
                break;
            } else {
                csort += csort2[i];
                csort += 'ä½ï¼š ';
                csort4[i] = csort4[i].replace(/ãƒ»(.*)/g, "");
                csort += csort4[i];
                csort += 'ã€€';
            }
        }

        for (i = 0; i < 300; i++) {
            if (csort4[i] == undefined) {
                break;
            } else {
                csort5 += csort2[i];
                csort5 += '. ';
                csort5 += csort6[i];
                csort5 += '<br>';
            }
        }

        // v2a end

        // Submit sorter results to server
        fnc_upload();

    } else {
        // åˆ¤å®šãŒçµ‚äº†ã—ã¦ã„ãªã„å ´åˆã€é¸æŠžè‚¢ã‚’æ›´æ–°ã€‚
        for (i = 0; i < 2; i++) {
            var obj_SelectItem = gID((i == 0) ? "fldLeft" : "fldRight");
            var obj_TempData = ary_TempData[ary_SortData[(i == 0) ? int_LeftList : int_RightList][(i == 0) ? int_LeftID : int_RightID]];
            var obj_ItemText = gID((i == 0) ? "fldLeftText" : "fldRightText");
            if ((obj_TempData[3].length > 0) && gID('optImage').checked) {
                var obj_Item = cE("img");
                obj_Item.src = str_ImgPath + obj_TempData[3];
                obj_Item.title = obj_TempData[1];
                obj_ItemText.textContent = obj_TempData[1]
            } else {
                var obj_Item = cE("span");
                obj_Item.appendChild(cT(obj_TempData[1]));
            }
            obj_Item.title = obj_TempData[1];
            obj_SelectItem.replaceChild(obj_Item, obj_SelectItem.firstChild);
        }

        int_Count++;
    }
}

function fnc_CC(sID, sClass) {
    sC(gID(sID), sClass);
}

function fnc_save() {
    if (int_Status == 0) () => { fnc_Sort(0); return; };
    let saveDataArray = {
        // int
        "int_Count": int_Count,
        "int_Status": int_Status,
        "int_RecordID": int_RecordID,
        "int_Completed": int_Completed,
        "int_Total": int_Total,

        "int_RightList": int_RightList,
        "int_RightID": int_RightID,
        "int_LeftList": int_LeftList,
        "int_LeftID": int_LeftID,
        "int_ResultRank": int_ResultRank,
        // array
        "ary_SortData": ary_SortData,
        "ary_EqualData": ary_EqualData,
        "ary_RecordData": ary_RecordData,
        "ary_TempData": ary_TempData,
        "ary_ParentData": ary_ParentData,
        // back array
        "back_ary_EqualData": back_ary_EqualData,
        "back_ary_ParentData": back_ary_ParentData,
        "back_ary_RecordData": back_ary_RecordData,
        "back_ary_SortData": back_ary_SortData,

        // back ints 
        "back_int_LeftID": back_int_LeftID,
        "back_int_LeftList": back_int_LeftList,
        "back_int_RecordID": back_int_RecordID,
        "back_int_RightList": back_int_RightList,
        "back_int_RightID": back_int_RightID,

        "back_int_Completed": back_int_Completed,
        "back_int_Total": back_int_Total,
        "hardMode": hardMode,
        "sorter_results_url": sorter_results_url
    }

    for (let data in saveDataArray) {
        localStorage.setItem(data, JSON.stringify(saveDataArray[data]))
    }

}

function fnc_load() {
    if (confirm("Do you want to load the save data?")) {
    if (gSD("ary_SortData") == undefined) { 
        alert("Your save file doesn't exist or is corrupted."); 
        return;
    }
    if (int_Status != 2 || int_Total - int_Completed) {
        ary_SortData = gSD("ary_SortData");
        ary_EqualData = gSD("ary_EqualData");
        ary_RecordData = gSD("ary_RecordData");
        ary_ParentData = gSD("ary_ParentData");
        ary_TempData = gSD("ary_TempData");

        int_Count = gSDI("int_Count") - 1;
        int_Completed = gSDI("int_Completed");
        int_Status = gSDI("int_Status");
        int_RecordID = gSDI("int_RecordID");
        int_Completed = gSDI("int_Completed");
        int_Total = gSDI("int_Total");
        int_ResultRank = gSDI("int_ResultRank");

        int_RightList = gSDI("int_RightList");
        int_LeftID = gSDI("int_LeftID");
        int_RightID = gSDI("int_RightID");
        int_LeftList = gSDI("int_LeftList");

        back_ary_EqualData = gSD("back_ary_EqualData");
        back_ary_ParentData = gSD("back_ary_ParentData");
        back_ary_RecordData = gSD("back_ary_RecordData");
        back_ary_SortData = gSD("back_ary_SortData");

        back_int_LeftID = gSDI("back_int_LeftID");
        back_int_LeftList = gSDI("back_int_LeftList");
        back_int_RecordID = gSDI("back_int_RecordID");
        back_int_RightID = gSDI("back_int_RightID");
        back_int_Completed = gSDI("back_int_Completed");
        back_int_Total = gSDI("back_int_Total");
        hardMode = gSD("hardMode") ? gSD("hardMode") : false;
        sorter_results_url = gSD("sorter_results_url") ? gSD("sorter_results_url") : "";
        gID("hardMode").disabled = true;
        gID("optImage").disabled = true;
        gID("sharableLink").value = window.location.href + "results?id=" + sorter_results_url;
        console.log(sorter_results_url);
        fnc_ShowData()
        
    } else {
        alert("The sorter is finished, not loading for you!");
        return;
    }
}
}

function fnc_importData(json) {
    for (i in json) { 
        localStorage[i] = json[i];
    }
    fnc_load();
}

function fnc_upload(force) {

    force = force || false; // Defaults to false

    if(force || (int_Status == 2 && sorter_results_url == "")) {
        gID("sharableLink").value = "Saving results.. please wait";

        $.post(server_url + "/upload", { data: JSON.stringify(ary_TempData), results: JSON.stringify(ary_SortData[0]) }, function(resp) {
            if(resp.success) {
                sorter_results_url = resp.code;
                gID("sharableLink").value = window.location.href + "results?id=" + sorter_results_url;
                fnc_save();
            } else {
                gID("sharableLink").value = "Something went wrong";
                alert("An error has occured when uploading the sorter results");
            }
        }).fail(function() {
            alert("An error has occured when uploading the sorter results");
        });
    }
}

function fnc_copy() {
    var sharable_link = gID("sharableLink");
    sharable_link.select();
    document.execCommand("copy");

    alert("Sorter results shared to clipboard");
}
