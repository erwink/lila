/*
 *  pgn4web javascript chessboard
 *  copyright (C) 2009, 2012 Paolo Casaschi
 *  see README file and http://pgn4web.casaschi.net
 *  for credits, license and more details
 */

var pgn4web_version = '2.56+';

var pgn4web_project_url = "http://pgn4web.casaschi.net";
var pgn4web_project_author = "Paolo Casaschi";
var pgn4web_project_email; // preassigned in pgn4web-server-config.js
if (typeof(pgn4web_project_email) == "undefined") { pgn4web_project_email = "pgn4web@casaschi.net"; }

var helpWin=null;
function displayHelp(section) {
  section = !section ? "" : "?" + section;
  if (helpWin && !helpWin.closed) { helpWin.close(); }
  helpWin = window.open(detectHelpLocation() + section, "pgn4web_help",
    "resizable=yes,scrollbars=yes,toolbar=no,location=no,menubar=no,status=no");
  if (helpWin && window.focus) { helpWin.focus(); }
}


// custom functions for given events
// to be redefined AFTER loading pgn4web.js

function customFunctionOnPgnTextLoad() {}
function customFunctionOnPgnGameLoad() {}
function customFunctionOnMove() {}
function customFunctionOnAlert(msg) {}
function customFunctionOnCheckLiveBroadcastStatus() {}

//custom header tags APIs for customFunctionOnPgnGameLoad()

function customPgnHeaderTag(customTagString, htmlElementIdString, gameNum) {
  customTagString = customTagString.replace(/\W+/g, "");
  if (gameNum === undefined) { gameNum = currentGame; }
  if ((pgnHeader[gameNum]) && (tagValues = pgnHeader[gameNum].match('\\[\\s*' + customTagString + '\\s*\"([^\"]+)\"\\s*\\]'))) {
    tagValue = tagValues[1];
  } else { tagValue = ""; }
  if ((htmlElementIdString) && (theObj = document.getElementById(htmlElementIdString)) && (typeof(theObj.innerHTML) == "string")) {
    theObj.innerHTML = tagValue;
  }
  return tagValue;
}

// custom comment tags APIS for customFunctionOnMove()

function customPgnCommentTag(customTagString, htmlElementIdString, plyNum, varId) {
  customTagString = customTagString.replace(/\W+/g, "");
  if (typeof(varId) == "undefined") { varId = 0; }
  if (typeof(plyNum) == "undefined") { plyNum = CurrentPly; }
  if ((MoveCommentsVar[varId][plyNum]) && (tagValues = MoveCommentsVar[varId][plyNum].match('\\[%' + customTagString + '\\s*([^\\]]+)\\s*\\]'))) {
    tagValue = tagValues[1];
  } else { tagValue = ""; }
  if ((htmlElementIdString) && (theObj = document.getElementById(htmlElementIdString)) && (typeof(theObj.innerHTML) == "string")) {
    theObj.innerHTML = tagValue;
  }
  return tagValue;
}


window.onload = start_pgn4web;

document.onkeydown = handlekey;

function start_pgn4web() {
  // keep startup logs at first run, reset when reloading start_pgn4web
  if (alertFirstResetLoadingPgn) { alertFirstResetLoadingPgn = false; }
  else { resetAlert(); }
  InitImages();
  createBoard();
  if (LiveBroadcastDelay > 0) { restartLiveBroadcastTimeout(); }
}

var alertLog;
var alertLast;
var alertNum;
var alertNumSinceReset;
var fatalErrorNumSinceReset;
var alertPromptInterval = null;
var alertPromptOn = false;
var alertFirstResetLoadingPgn = true;

resetAlert();

function resetAlert() {
  alertLog = new Array(5);
  alertLast = alertLog.length - 1;
  alertNum = alertNumSinceReset = fatalErrorNumSinceReset = 0;
  stopAlertPrompt();
  if (!alertFirstResetLoadingPgn) {
    if (boardIsDefault(debugShortcutSquare)) { boardShortcut(debugShortcutSquare, "pgn4web v" + pgn4web_version + " debug info", null, true); }
  }
}

function myAlert(msg, fatalError) {
  alertNum++;
  alertNumSinceReset++;
  if (fatalError) { fatalErrorNumSinceReset++; }
  alertLast = (alertLast + 1) % alertLog.length;
  alertLog[alertLast] = msg  + "\n" + (new Date()).toLocaleString();
  if (boardIsDefault(debugShortcutSquare)) { boardShortcut(debugShortcutSquare, "pgn4web v" + pgn4web_version + " debug info, " + alertNum + " alert" + (alertNum > 1 ? "s" : ""), null, true); }
  if (((LiveBroadcastDelay === 0) || (LiveBroadcastAlert === true)) && (boardIsDefault(debugShortcutSquare))) {
    startAlertPrompt();
  }
  customFunctionOnAlert(msg);
}

function startAlertPrompt() {
  if (alertPromptOn) { return; } // dont start flashing twice
  if (alertPromptInterval) { clearTimeout(alertPromptInterval); }
  alertPromptInterval = setTimeout("alertPromptTick(true);", 500);
}

function stopAlertPrompt() {
  if (alertPromptInterval) {
    clearTimeout(alertPromptInterval);
    alertPromptInterval = null;
  }
  if (alertPromptOn) { alertPromptTick(false); }
}

function alertPromptTick(restart) {
  if (alertPromptInterval) {
    clearTimeout(alertPromptInterval);
    alertPromptInterval = null;
  }
  var debugColRow = colRowFromSquare(debugShortcutSquare);
  if (!debugColRow) { return; }
  if (theObj = document.getElementById('tcol' + debugColRow.col + 'trow' + debugColRow.row)) {
    if (alertPromptOn) {
      if ((highlightOption) &&
        ((lastColFromHighlighted === 0 && lastRowFromHighlighted === 7) ||
        (lastColToHighlighted === 0 && lastRowToHighlighted === 7))) {
          theObj.className = 'highlightWhiteSquare';
        } else { theObj.className = 'whiteSquare'; }
    } else { theObj.className = 'blackSquare'; }

    alertPromptOn = !alertPromptOn;
    if (alertPromptOn) { alertPromptDelay = 500; }
    else { alertPromptDelay = 3000; }
  } else { alertPromptDelay = 1500; } // alerts before the baord is drawn
  if (restart) { alertPromptInterval = setTimeout("alertPromptTick(true);", alertPromptDelay); }
}


function stopKeyProp(e) {
  e.cancelBubble = true;
  if (e.stopPropagation) { e.stopPropagation(); }
  if (e.preventDefault) { e.preventDefault(); }
  return false;
}

// for onFocus and onBlur textbox events, allowing text typing
var shortcutKeysWereEnabled = false;
function disableShortcutKeysAndStoreStatus() {
  if ((shortcutKeysWereEnabled = shortcutKeysEnabled) === true) {
    SetShortcutKeysEnabled(false);
  }
}
function restoreShortcutKeysStatus() {
  if (shortcutKeysWereEnabled === true) { SetShortcutKeysEnabled(true); }
  shortcutKeysWereEnabled = false;
}

function customShortcutKey_Shift_0() {}
function customShortcutKey_Shift_1() {}
function customShortcutKey_Shift_2() {}
function customShortcutKey_Shift_3() {}
function customShortcutKey_Shift_4() {}
function customShortcutKey_Shift_5() {}
function customShortcutKey_Shift_6() {}
function customShortcutKey_Shift_7() {}
function customShortcutKey_Shift_8() {}
function customShortcutKey_Shift_9() {}

var shortcutKeysEnabled = false;
function handlekey(e) {
  var keycode, oldPly, oldVar;

  if (!e) { e = window.event; }

  keycode = e.keyCode;

  if (e.altKey || e.ctrlKey || e.metaKey) { return true; }

  // shift-escape always enabled: toggle shortcut keys
  if (!shortcutKeysEnabled && !(keycode == 27 && e.shiftKey)) { return true; }

  switch (keycode) {

    case  8: // backspace
    case  9: // tab
    case 16: // shift
    case 17: // ctrl
    case 18: // alt
    case 32: // space
    case 35: // end
    case 36: // home
    case 33: // page-up
    case 34: // page-down
    case 92: // super
    case 93: // menu
    case 188: // comma
      return true;

    case 27: // escape
      if (e.shiftKey) { interactivelyToggleShortcutKeys(); }
      else { displayHelp(); }
      break;

    case 90: // z
      if (e.shiftKey) { window.open(pgn4web_project_url); }
      else { displayDebugInfo(); }
      break;

    case 37: // left-arrow
    case 74: // j
      backButton(e);
      break;

    case 38: // up-arrow
    case 72: // h
      startButton(e);
      break;

    case 39: // right-arrow
    case 75: // k
      forwardButton(e);
      break;

    case 40: // down-arrow
    case 76: // l
      endButton(e);
      break;

    case 73: // i
      MoveToPrevComment(e.shiftKey);
      break;

    case 79: // o
      MoveToNextComment(e.shiftKey);
      break;

    case 190: // dot
      if (e.shiftKey) { goToFirstChild(); }
      else { goToNextVariationSibling(); }
      break;

    case 85: // u
      if (e.shiftKey) { undoStackRedo(); }
      else { undoStackUndo(); }
      break;

    case 45: // insert
      undoStackRedo();
      break;

    case 46: // delete
      undoStackUndo();
      break;

    case 83: // s
      searchPgnGamePrompt();
      break;

    case 13: // enter
      if (e.shiftKey) { searchPgnGame(lastSearchPgnExpression, true); }
      else { searchPgnGame(lastSearchPgnExpression); }
      break;

    case 68: // d
      if (e.shiftKey) { displayFenData(); }
      else { displayPgnData(false); }
      break;

    case 65: // a
      GoToMove(CurrentPly + 1);
      SetAutoPlay(true);
      break;

    case 48: // 0
      if (e.shiftKey) { customShortcutKey_Shift_0(); }
      else { SetAutoPlay(false); }
      break;

    case 49: // 1
      if (e.shiftKey) { customShortcutKey_Shift_1(); }
      else { SetAutoplayDelayAndStart( 1*1000); }
      break;

    case 50: // 2
      if (e.shiftKey) { customShortcutKey_Shift_2(); }
      else { SetAutoplayDelayAndStart( 2*1000); }
      break;

    case 51: // 3
      if (e.shiftKey) { customShortcutKey_Shift_3(); }
      else { SetAutoplayDelayAndStart( 3*1000); }
      break;

    case 52: // 4
      if (e.shiftKey) { customShortcutKey_Shift_4(); }
      else { SetAutoplayDelayAndStart( 4*1000); }
      break;

    case 53: // 5
      if (e.shiftKey) { customShortcutKey_Shift_5(); }
      else { SetAutoplayDelayAndStart( 5*1000); }
      break;

    case 54: // 6
      if (e.shiftKey) { customShortcutKey_Shift_6(); }
      else { SetAutoplayDelayAndStart( 6*1000); }
      break;

    case 55: // 7
      if (e.shiftKey) { customShortcutKey_Shift_7(); }
      else { SetAutoplayDelayAndStart( 7*1000); }
      break;

    case 56: // 8
      if (e.shiftKey) { customShortcutKey_Shift_8(); }
      else { SetAutoplayDelayAndStart( 8*1000); }
      break;

    case 57: // 9
      if (e.shiftKey) { customShortcutKey_Shift_9(); }
      else { SetAutoplayDelayAndStart( 9*1000); }
      break;

    case 81: // q
      SetAutoplayDelayAndStart(10*1000);
      break;

    case 87: // w
      SetAutoplayDelayAndStart(20*1000);
      break;

    case 69: // e
      SetAutoplayDelayAndStart(30*1000);
      break;

    case 82: // r
      pauseLiveBroadcast();
      break;

    case 84: // t
      if (e.shiftKey) { LiveBroadcastSteppingMode = !LiveBroadcastSteppingMode; }
      else { refreshPgnSource(); }
      break;

    case 89: // y
      resumeLiveBroadcast();
      break;

    case 70: // f
      if (!e.shiftKey || IsRotated) { FlipBoard(); }
      break;

    case 71: // g
      SetHighlight(!highlightOption);
      break;

    case 88: // x
      randomGameRandomPly();
      break;

    case 67: // c
      if (numberOfGames > 1) { Init(Math.floor(Math.random()*numberOfGames)); }
      break;

    case 86: // v
      if (numberOfGames > 1) { Init(0); }
      break;

    case 66: // b
      Init(currentGame - 1);
      break;

    case 78: // n
      Init(currentGame + 1);
      break;

    case 77: // m
      if (numberOfGames > 1) { Init(numberOfGames - 1); }
      break;

    case 80: // p
      if (e.shiftKey) { SetCommentsOnSeparateLines(!commentsOnSeparateLines); }
      else { SetCommentsIntoMoveText(!commentsIntoMoveText); }
      oldPly = CurrentPly;
      oldVar = CurrentVar;
      Init();
      GoToMove(oldPly, oldVar);
      break;

    default:
      return true;
  }
  return stopKeyProp(e);
}

boardOnClick = new Array(8);
boardTitle = new Array(8);
boardDefault = new Array(8);
for (col=0; col<8; col++) {
  boardOnClick[col] = new Array(8);
  boardTitle[col] = new Array(8);
  boardDefault[col] = new Array(8);
}
clearShortcutSquares("ABCDEFGH", "12345678");

function colRowFromSquare(square) {
  if (square.charCodeAt === null) { return -1; }
  var col = square.charCodeAt(0) - 65; // 65="A"
  if ((col < 0) || (col > 7)) { return null; }
  var row = 56 - square.charCodeAt(1); // 56="8"
  if ((row < 0) || (row > 7)) { return null; }
  return { "col": col, "row": row };
}

function clearShortcutSquares(cols, rows) {
  if ((typeof cols != "string") || (typeof rows != "string")) { return; }
  for (c=0; c<cols.length; c++) { for (r=0; r<rows.length; r++) {
      boardShortcut(cols.charAt(c).toUpperCase()+rows.charAt(r), "", function(t,e){});
  } }
}

function boardIsDefault(square) {
  var colRow = colRowFromSquare(square);
  if (!colRow) { return false; }
  return boardDefault[colRow.col][colRow.row];
}

function boardShortcut(square, title, functionPointer, defaultSetting) {
  var theObj, colRow = colRowFromSquare(square);
  if (!colRow) { return; }
  else { var col = colRow.col; var row = colRow.row; }
  boardTitle[col][row] = title;
  if (functionPointer) { boardOnClick[col][row] = functionPointer; }
  boardDefault[col][row] = defaultSetting ? true : false;
  if (theObj = document.getElementById('img_tcol' + col + 'trow' + row)) {
    if (IsRotated) { square = String.fromCharCode(72-col,49+row); }
    squareTitle = square + (boardTitle[col][row] ? ': ' + boardTitle[col][row] : '');
    theObj.title = squareTitle;
  }
}

// PLEASE NOTE: 'boardShortcut' ALWAYS ASSUMES 'square' WITH WHITE ON BOTTOM

debugShortcutSquare = "A8";

// A8
boardShortcut("A8", "pgn4web v" + pgn4web_version + " debug info", function(t,e){ displayDebugInfo(); }, true);
// B8
boardShortcut("B8", "show this position FEN string", function(t,e){ displayFenData(); }, true);
// C8
boardShortcut("C8", "show this game PGN source data", function(t,e){ displayPgnData(false); }, true);
// D8
boardShortcut("D8", "show full PGN source data", function(t,e){ displayPgnData(true); }, true);
// E8
boardShortcut("E8", "search help", function(t,e){ displayHelp(e.shiftKey ? "informant_symbols" : "search_tool"); }, true);
// F8
boardShortcut("F8", "shortcut keys help", function(t,e){ displayHelp("shortcut_keys"); }, true);
// G8
boardShortcut("G8", "shortcut squares help", function(t,e){ displayHelp("shortcut_squares"); }, true);
// H8
boardShortcut("H8", "pgn4web help", function(t,e){ displayHelp(e.shiftKey ? "credits_and_license" : ""); }, true);
// A7
boardShortcut("A7", "pgn4web website", function(t,e){ window.open(pgn4web_project_url); }, true);
// B7
boardShortcut("B7", "undo last chessboard position update", function(t,e){ undoStackUndo(); }, true);
// C7
boardShortcut("C7", "redo last undo", function(t,e){ undoStackRedo(); }, true);
// D7
boardShortcut("D7", "toggle highlight last move", function(t,e){ SetHighlight(!highlightOption); }, true);
// E7
boardShortcut("E7", "flip board", function(t,e){ if (!e.shiftKey || IsRotated) { FlipBoard(); } }, true);
// F7
boardShortcut("F7", "toggle show comments in game text", function(t,e){ if (e.shiftKey) { SetCommentsOnSeparateLines(!commentsOnSeparateLines); } else { SetCommentsIntoMoveText(!commentsIntoMoveText); } var oldPly = CurrentPly; var oldVar = CurrentVar; Init(); GoToMove(oldPly, oldVar); }, true);
// G7
boardShortcut("G7", "toggle autoplay next game", function(t,e){ SetAutoplayNextGame(!autoplayNextGame); }, true);
// H7
boardShortcut("H7", "toggle enabling shortcut keys", function(t,e){ interactivelyToggleShortcutKeys(); }, true);
// A6
boardShortcut("A6", "pause live broadcast automatic refresh", function(t,e){ pauseLiveBroadcast(); }, true);
// B6
boardShortcut("B6", "restart live broadcast automatic refresh", function(t,e){ restartLiveBroadcast(); }, true);
// C6
boardShortcut("C6", "search previous finished game", function(t,e){ searchPgnGame('\\[\\s*Result\\s*"(?!\\*"\\s*\\])', true); });
// D6
boardShortcut("D6", "search previous unfinished game", function(t,e){ searchPgnGame('\\[\\s*Result\\s*"\\*"\\s*\\]', true); });
// E6
boardShortcut("E6", "search next unfinished game", function(t,e){  searchPgnGame('\\[\\s*Result\\s*"\\*"\\s*\\]', false); }, true);
// F6
boardShortcut("F6", "search next finished game", function(t,e){ searchPgnGame('\\[\\s*Result\\s*"(?!\\*"\\s*\\])', false); }, true);
// G6
boardShortcut("G6", "toggle live broadcast stepping", function(t,e){ LiveBroadcastSteppingMode = !LiveBroadcastSteppingMode; }, true);
// H6
boardShortcut("H6", "force games refresh during live broadcast", function(t,e){ refreshPgnSource(); }, true);
// A5
boardShortcut("A5", "repeat last search backward", function(t,e){ searchPgnGame(lastSearchPgnExpression, true); }, true);
// B5
boardShortcut("B5", "search prompt", function(t,e){ searchPgnGamePrompt(); }, true);
// C5
boardShortcut("C5", "repeat last search", function(t,e){ searchPgnGame(lastSearchPgnExpression); }, true);
// D5
boardShortcut("D5", "search previous win result", function(t,e){ searchPgnGame('\\[\\s*Result\\s*"(1-0|0-1)"\\s*\\]', true); }, true);
// E5
boardShortcut("E5", "search next win result", function(t,e){ searchPgnGame('\\[\\s*Result\\s*"(1-0|0-1)"\\s*\\]', false); }, true);
// F5
boardShortcut("F5", "", function(t,e){}, true);
// G5
boardShortcut("G5", "", function(t,e){}, true);
// H5
boardShortcut("H5", "", function(t,e){}, true);
// A4
boardShortcut("A4", "search previous event", function(t,e){ searchPgnGame('\\[\\s*Event\\s*"(?!' + fixRegExp(gameEvent[currentGame]) + '"\\s*\\])', true); }, true);
// B4
boardShortcut("B4", "search previous round of same event", function(t,e){ searchPgnGame('\\[\\s*Event\\s*"' + fixRegExp(gameEvent[currentGame]) + '"\\s*\\].*\\[\\s*Round\\s*"(?!' + fixRegExp(gameRound[currentGame]) + '"\\s*\\])|\\[\\s*Event\\s*"' + fixRegExp(gameEvent[currentGame]) + '"\\s*\\].*\\[\\s*Round\\s*"(?!' + fixRegExp(gameRound[currentGame]) + '"\\s*\\])', true); }, true);
// C4
boardShortcut("C4", "search previous game of same black player", function(t,e){ searchPgnGame('\\[\\s*Black\\s*"' + fixRegExp(gameBlack[currentGame]) + '"\\s*\\]', true); }, true);
// D4
boardShortcut("D4", "search previous game of same white player", function(t,e){ searchPgnGame('\\[\\s*White\\s*"' + fixRegExp(gameWhite[currentGame]) + '"\\s*\\]', true); }, true);
// E4
boardShortcut("E4", "search next game of same white player", function(t,e){ searchPgnGame('\\[\\s*White\\s*"' + fixRegExp(gameWhite[currentGame]) + '"\\s*\\]', false); }, true);
// F4
boardShortcut("F4", "search next game of same black player", function(t,e){  searchPgnGame('\\[\\s*Black\\s*"' + fixRegExp(gameBlack[currentGame]) + '"\\s*\\]', false); }, true);
// G4
boardShortcut("G4", "search next round of same event", function(t,e){ searchPgnGame('\\[\\s*Event\\s*"' + fixRegExp(gameEvent[currentGame]) + '"\\s*\\].*\\[\\s*Round\\s*"(?!' + fixRegExp(gameRound[currentGame]) + '"\\s*\\])|\\[\\s*Event\\s*"' + fixRegExp(gameEvent[currentGame]) + '"\\s*\\].*\\[\\s*Round\\s*"(?!' + fixRegExp(gameRound[currentGame]) + '"\\s*\\])', false); }, true);
// H4
boardShortcut("H4", "search next event", function(t,e){ searchPgnGame('\\[\\s*Event\\s*"(?!' + fixRegExp(gameEvent[currentGame]) + '"\\s*\\])', false); }, true);
// A3
boardShortcut("A3", "load first game", function(t,e){ if (numberOfGames > 1) { Init(0); } }, true);
// B3
boardShortcut("B3", "jump to previous games decile", function(t,e){ if (currentGame > 0) { calculateDeciles(); for (ii=(deciles.length-2); ii>=0; ii--) { if (currentGame > deciles[ii]) { Init(deciles[ii]); break; } } } }, true);
// C3
boardShortcut("C3", "load previous game", function(t,e){ Init(currentGame - 1); }, true);
// D3
boardShortcut("D3", "load random game", function(t,e){ if (numberOfGames > 1) { Init(Math.floor(Math.random()*numberOfGames)); } }, true);
// E3
boardShortcut("E3", "load random game at random position", function(t,e){ randomGameRandomPly(); }, true);
// F3
boardShortcut("F3", "load next game", function(t,e){ Init(currentGame + 1); }, true);
// G3
boardShortcut("G3", "jump to next games decile", function(t,e){ if (currentGame < numberOfGames - 1) { calculateDeciles(); for (ii=1; ii<deciles.length; ii++) { if (currentGame < deciles[ii]) { Init(deciles[ii]); break; } } } }, true);
// H3
boardShortcut("H3", "load last game", function(t,e){ if (numberOfGames > 1) { Init(numberOfGames - 1); } }, true);
// A2
boardShortcut("A2", "stop autoplay", function(t,e){ SetAutoPlay(e.shiftKey); }, true);
// B2
boardShortcut("B2", "toggle autoplay", function(t,e){ SwitchAutoPlay(); }, true);
// C2
boardShortcut("C2", "autoplay 1 second", function(t,e){ SetAutoplayDelayAndStart((e.shiftKey ? 10 : 1)*1000); }, true);
// D2
boardShortcut("D2", "autoplay 2 seconds", function(t,e){ SetAutoplayDelayAndStart((e.shiftKey ? 20 : 2)*1000); }, true);
// E2
boardShortcut("E2", "autoplay 5 seconds", function(t,e){ SetAutoplayDelayAndStart((e.shiftKey ? 50 : 5)*1000); }, true);
// F2
boardShortcut("F2", "autoplay custom delay", function(t,e){ setCustomAutoplayDelay(); }, true);
// G2
boardShortcut("G2", "replay up to 6 previous half-moves, then autoplay forward", function(t,e){ replayPreviousMoves(e.shiftKey ? 10 : 6); }, true);
// H2
boardShortcut("H2", "replay the previous half-move, then autoplay forward", function(t,e){ replayPreviousMoves(e.shiftKey ? 3 : 1); }, true);
// A1
boardShortcut("A1", "go to game start", function(t,e){ startButton(e); }, true);
// B1 see setB1C1F1G1boardShortcuts()
boardShortcut("B1", "", function(t,e){}, true);
// C1 see setB1C1F1G1boardShortcuts()
boardShortcut("C1", "", function(t,e){}, true);
// D1
boardShortcut("D1", "move backward", function(t,e){ GoToMove(CurrentPly - 1); }, true);
// E1
boardShortcut("E1", "move forward", function(t,e){ GoToMove(CurrentPly + 1); }, true);
// F1 see setB1C1F1G1boardShortcuts()
boardShortcut("F1", "", function(t,e){}, true);
// G1 see setB1C1F1G1boardShortcuts()
boardShortcut("G1", "", function(t,e){}, true);
// H1
boardShortcut("H1", "go to game end", function(t,e){ endButton(e); }, true);

setB1C1F1G1boardShortcuts();

function setB1C1F1G1boardShortcuts() {
  if (commentsIntoMoveText && GameHasComments) {
    if (boardIsDefault("B1")) { boardShortcut("B1", "go to previous comment or variation", function(t,e){ if (e.shiftKey) { GoToMove(CurrentPly - 10); } else { MoveToPrevComment(); } }, true); }
    if (boardIsDefault("G1")) { boardShortcut("G1", "go to next comment or variation", function(t,e){ if (e.shiftKey) { GoToMove(CurrentPly + 10); } else { MoveToNextComment(); } }, true); }
  } else {
    if (boardIsDefault("B1")) { boardShortcut("B1", "move 10 half-moves backward", function(t,e){ GoToMove(CurrentPly - 10); }, true); }
    if (boardIsDefault("G1")) { boardShortcut("G1", "move 10 half-moves forward", function(t,e){ GoToMove(CurrentPly + 10); }, true); }
  }
  if (commentsIntoMoveText && GameHasVariations) {
    if (boardIsDefault("C1")) { boardShortcut("C1", "go to parent variation", function(t,e){ if (e.shiftKey) { GoToMove(CurrentPly - 6); } else { GoToMove(StartPlyVar[CurrentVar]); } }, true); }
    if (boardIsDefault("F1")) { boardShortcut("F1", "cycle through alternative variations, if any, otherwise move forward", function(t,e){ if (e.shiftKey) { GoToMove(CurrentPly + 6); } else { if (!goToNextVariationSibling()) { GoToMove(CurrentPly + 1); } } }, true); }
  } else {
    if (boardIsDefault("C1")) { boardShortcut("C1", "move 6 half-moves backward", function(t,e){ GoToMove(CurrentPly - 6); }, true); }
    if (boardIsDefault("F1")) { boardShortcut("F1", "move 6 half-moves forward", function(t,e){ GoToMove(CurrentPly + 6); }, true); }
  }
}

var deciles = new Array(11);
function calculateDeciles() {
  for (ii=0; ii<deciles.length; ii++) {
    deciles[ii] = Math.round((numberOfGames - 1) * ii / (deciles.length - 1));
  }
}

function replayPreviousMoves(numPlies) {
  targetPly = numPlies ? CurrentPly - numPlies : StartPly;
  if (targetPly < StartPlyVar[CurrentVar]) {
    targetPly = StartPlyVar[CurrentVar] + (CurrentVar === 0 ? 0 : 1);
  }
  if (targetPly !== CurrentPly) { GoToMove(targetPly); }
  SetAutoPlay(true);
}

function detectJavascriptLocation() {
  var e = document.getElementsByTagName("script");
  for (var i=0; i<e.length; i++) {
    if ((e[i].src) && (e[i].src.match(/(pgn4web|pgn4web-compacted)\.js/))) {
      return e[i].src;
    }
  }
  return "";
}

function detectHelpLocation() {
  return detectJavascriptLocation().replace(/(pgn4web|pgn4web-compacted)\.js/, "pgn4web-help.html");
}

function detectBaseLocation() {
  var e = document.getElementsByTagName("base");
  for (var i=0; i<e.length; i++) {
    if (e[i].href) { return e[i].href; }
  }
  return "";
}


debugWin = null;
function displayDebugInfo() {
  var base = detectBaseLocation();
  var jsurl = detectJavascriptLocation();
  stopAlertPrompt();
  var debugInfo = 'pgn4web: version=' + pgn4web_version + ' homepage=' + pgn4web_project_url + '\n\n' +
    'HTMLURL: length=' + location.href.length + ' url=' +
    (location.href.length < 100 ? location.href : (location.href.substring(0,99) + '...')) + '\n' +
    (base ? 'BASEURL: url=' + base + '\n' : '') +
    (jsurl != 'pgn4web.js' ? 'JSURL: url=' + jsurl + '\n' : '');
  if (pgnUrl) {
    debugInfo += 'PGNURL: url=' + pgnUrl;
  } else {
    if (theObj = document.getElementById("pgnText")) {
      debugInfo += 'PGNTEXT: length=' + (theObj.tagName.toLowerCase() == "textarea" ? theObj.value.length : "?");
    }
  }
  debugInfo += '\n\n' +
    'GAME: current=' + (currentGame+1) + ' number=' + numberOfGames + '\n' +
    'VARIATION: current=' + CurrentVar + ' number=' + (numberOfVars-1) + '\n' +
    'PLY: start=' + StartPly + ' current=' + CurrentPly + ' number=' + PlyNumber + '\n' +
    'AUTOPLAY: status=' + (isAutoPlayOn ? 'on' : 'off') + ' delay=' + Delay + 'ms' + ' next=' + autoplayNextGame +
    '\n\n';
  if (LiveBroadcastDelay > 0) {
    debugInfo += 'LIVEBROADCAST: status=' + liveStatusDebug() + ' ticker=' + LiveBroadcastTicker + ' delay=' + LiveBroadcastDelay + 'm' + '\n' + 'refreshed: ' + LiveBroadcastLastRefreshedLocal + '\n' + 'received: ' + LiveBroadcastLastReceivedLocal + '\n' + 'modified (server time): ' + LiveBroadcastLastModified_ServerTime() +
    '\n\n';
  }
  var thisInfo = customDebugInfo();
  if (thisInfo) { debugInfo += "CUSTOM: " + thisInfo + "\n\n"; }
  debugInfo += 'ALERTLOG: fatalnew=' + fatalErrorNumSinceReset + ' new=' + alertNumSinceReset +
    ' shown=' + Math.min(alertNum, alertLog.length) + ' total=' + alertNum + '\n--';
  if (alertNum > 0) {
    for (ii = 0; ii<alertLog.length; ii++) {
      if (alertLog[(alertNum - 1 - ii) % alertLog.length] === undefined) { break; }
      else { debugInfo += "\n" + alertLog[(alertNum - 1 - ii) % alertLog.length] + "\n--"; }
    }
  }
  if (confirm(debugInfo + '\n\nclick OK to show this debug info in a browser window for cut and paste')) {
    if (debugWin && !debugWin.closed) { debugWin.close(); }
    debugWin = window.open("", "debug_data",
      "resizable=yes,scrollbars=yes,toolbar=no,location=no,menubar=no,status=no");
    if (debugWin) {
      text = "<html><head><title>pgn4web debug info</title>" +
        "<link rel='shortcut icon' href='pawn.ico' /></head>" +
        "<body>\n<pre>\n" + debugInfo + "\n</pre>\n</body></html>";
      debugWin.document.open("text/html", "replace");
      debugWin.document.write(text);
      debugWin.document.close();
      if (window.focus) { debugWin.focus(); }
    }
  }
  alertNumSinceReset = fatalErrorNumSinceReset = 0;
}

function liveStatusDebug() {
  if (LiveBroadcastEnded) { return "ended"; }
  if (LiveBroadcastPaused) { return "paused"; }
  if (LiveBroadcastStarted) { return "started"; }
  return "waiting";
}

function customDebugInfo() { return ""; }

pgnWin = null;
function displayPgnData(allGames) {
  if (typeof(allGames) == "undefined") { allGames = true; }
  if (pgnWin && !pgnWin.closed) { pgnWin.close(); }
  pgnWin = window.open("", "pgn_data",
    "resizable=yes,scrollbars=yes,toolbar=no,location=no,menubar=no,status=no");
  if (pgnWin) {
    text = "<html><head><title>pgn4web PGN source</title>" +
      "<link rel='shortcut icon' href='pawn.ico' /></head><body>\n<pre>\n";
    if (allGames) { for (ii = 0; ii < numberOfGames; ++ii) { text += fullPgnGame(ii) + "\n\n"; } }
    else { text += fullPgnGame(currentGame); }
    text += "\n</pre>\n</body></html>";
    pgnWin.document.open("text/html", "replace");
    pgnWin.document.write(text);
    pgnWin.document.close();
    if (window.focus) { pgnWin.focus(); }
  }
}

function CurrentFEN() {
  currentFEN = "";

  emptyCounterFen = 0;
  for (row=7; row>=0; row--) {
    for (col=0; col<=7; col++) {
      if (Board[col][row] === 0) { emptyCounterFen++; }
      else {
        if (emptyCounterFen > 0) {
          currentFEN += "" + emptyCounterFen;
          emptyCounterFen = 0;
        }
        if (Board[col][row] > 0) { currentFEN += FenPieceName.charAt(Board[col][row]-1).toUpperCase(); }
        else if (Board[col][row] < 0) { currentFEN += FenPieceName.charAt(-Board[col][row]-1).toLowerCase(); }
      }
    }
    if (emptyCounterFen > 0) {
      currentFEN += "" + emptyCounterFen;
      emptyCounterFen = 0;
    }
    if (row>0) { currentFEN += "/"; }
  }

  // active color
  currentFEN += CurrentPly%2 === 0 ? " w" : " b";

  // castling availability, always in the KQkq form
  // (wrong FEN for for Chess960 positions with an inner castling rook)
  CastlingFEN = "";
  if (RookForOOCastling(0) !== null) { CastlingFEN += FenPieceName.charAt(0).toUpperCase(); }
  if (RookForOOOCastling(0) !== null) { CastlingFEN += FenPieceName.charAt(1).toUpperCase(); }
  if (RookForOOCastling(1) !== null) { CastlingFEN += FenPieceName.charAt(0).toLowerCase(); }
  if (RookForOOOCastling(1) !== null) { CastlingFEN += FenPieceName.charAt(1).toLowerCase(); }
  currentFEN += " " + (CastlingFEN ? CastlingFEN : "-");

  // en-passant square
  if (HistEnPassant[CurrentPly]) {
    currentFEN += " " + String.fromCharCode(HistEnPassantCol[CurrentPly] + 97);
    currentFEN += CurrentPly%2 === 0 ? "6" : "3";
  } else { currentFEN += " -"; }

  // halfmove clock
  HalfMoveClock = InitialHalfMoveClock;
  for (thisPly = StartPly; thisPly < CurrentPly; thisPly++) {
    if ((HistType[0][thisPly] == 6) || (HistPieceId[1][thisPly] >= 16)) { HalfMoveClock = 0; }
    else { HalfMoveClock++; }
  }
  currentFEN += " " + HalfMoveClock;

  // fullmove number
  currentFEN += " " + (Math.floor(CurrentPly/2)+1);

  return currentFEN;
}

fenWin = null;
function displayFenData() {
  if (fenWin && !fenWin.closed) { fenWin.close(); }

  currentFEN = CurrentFEN();

  currentMovesString = "";
  lastLineStart = 0;
  for (var thisPly = CurrentPly; thisPly <= StartPlyVar[CurrentVar] + PlyNumberVar[CurrentVar]; thisPly++) {
    addToMovesString = "";
    if (thisPly == StartPlyVar[CurrentVar] + PlyNumberVar[CurrentVar]) {
      if (CurrentVar === 0 && gameResult[currentGame] && gameResult[currentGame] != "*") {
        addToMovesString = gameResult[currentGame];
      }
    } else {
      if (thisPly%2 === 0) { addToMovesString = (Math.floor(thisPly/2)+1) + ". "; }
      else if (thisPly == CurrentPly) {
        addToMovesString = (Math.floor(thisPly/2)+1) + "... ";
      }
      addToMovesString += Moves[thisPly];
    }
    if (currentMovesString.length + addToMovesString.length + 1 > lastLineStart + 80) {
      lastLineStart = currentMovesString.length;
      currentMovesString += "\n" + addToMovesString;
    } else {
      if (currentMovesString.length > 0) { currentMovesString += " "; }
      currentMovesString += addToMovesString;
    }
  }

  fenWin = window.open("", "fen_data",
    "resizable=yes,scrollbars=yes,toolbar=no,location=no,menubar=no,status=no");
  if (fenWin) {
    text = "<html>" +
      "<head><title>pgn4web FEN string</title><link rel='shortcut icon' href='pawn.ico' /></head>" +
      "<body>\n<b><pre>\n\n" + currentFEN + "\n\n</pre></b>\n<hr>\n<pre>\n\n" +
      "[Event \"" + (gameEvent[currentGame] ? gameEvent[currentGame] : "?") + "\"]\n" +
      "[Site \"" + (gameSite[currentGame] ? gameSite[currentGame] : "?") + "\"]\n" +
      "[Date \"" + (gameDate[currentGame] ? gameDate[currentGame] : "????.??.??") + "\"]\n" +
      "[Round \"" + (gameRound[currentGame] ? gameRound[currentGame] : "?") + "\"]\n" +
      "[White \"" + (gameWhite[currentGame] ? gameWhite[currentGame] : "?") + "\"]\n" +
      "[Black \"" + (gameBlack[currentGame] ? gameBlack[currentGame] : "?") + "\"]\n" +
      "[Result \"" + (gameResult[currentGame] ? gameResult[currentGame] : "*") + "\"]\n";
    if (currentFEN != FenStringStart) {
      text += "[SetUp \"1\"]\n" + "[FEN \"" + CurrentFEN() + "\"]\n";
    }
    if (gameVariant[currentGame] !== "") { text += "[Variant \"" + gameVariant[currentGame] + "\"]\n"; }
    text += "\n" + currentMovesString + "\n</pre>\n</body></html>";
    fenWin.document.open("text/html", "replace");
    fenWin.document.write(text);
    fenWin.document.close();
    if (window.focus) { fenWin.focus(); }
  }
}


var pgnHeader = new Array();
var pgnGame = new Array();
var numberOfGames = -1;
var currentGame   = -1;

var firstStart = true;

var gameDate = new Array();
var gameWhite = new Array();
var gameBlack = new Array();
var gameEvent = new Array();
var gameSite = new Array();
var gameRound = new Array();
var gameResult = new Array();
var gameSetUp = new Array();
var gameFEN = new Array();
var gameInitialWhiteClock = new Array();
var gameInitialBlackClock = new Array();
var gameVariant = new Array();

var oldAnchorName = "";

var isAutoPlayOn = false;
var AutoPlayInterval = null;
var Delay = 1000; // milliseconds
var autostartAutoplay = false;
var autoplayNextGame = false;

var initialGame = 1;
var initialVariation = 0;
var initialHalfmove = 0;
var alwaysInitialHalfmove = false;

var LiveBroadcastInterval = null;
var LiveBroadcastDelay = 0; // minutes
var LiveBroadcastAlert = false;
var LiveBroadcastDemo = false;
var LiveBroadcastStarted = false;
var LiveBroadcastEnded = false;
var LiveBroadcastPaused = false;
var LiveBroadcastTicker = 0;
var LiveBroadcastGamesRunning = 0;
var LiveBroadcastStatusString = "";
var LiveBroadcastLastModified = new Date(0); // default to epoch start
var LiveBroadcastLastModifiedHeader = LiveBroadcastLastModified.toUTCString();
var LiveBroadcastLastReceivedLocal = 'unavailable';
var LiveBroadcastLastRefreshedLocal = 'unavailable';
var LiveBroadcastPlaceholderEvent = 'live chess broadcast';
var LiveBroadcastPlaceholderPgn = '[Event "' + LiveBroadcastPlaceholderEvent + '"]';
var gameDemoMaxPly = new Array();
var gameDemoLength = new Array();
var LiveBroadcastSteppingMode = false;

var ParseLastMoveError = false;

var castleRook = -1;
var mvCapture =  0;
var mvIsCastling =  0;
var mvIsPromotion =  0;
var mvFromCol = -1;
var mvFromRow = -1;
var mvToCol = -1;
var mvToRow = -1;
var mvPiece = -1;
var mvPieceId = -1;
var mvPieceOnTo = -1;
var mvCaptured = -1;
var mvCapturedId = -1;
var mvIsNull = 0;

Board = new Array(8);
for (i=0; i<8; ++i) { Board[i] = new Array(8); }

// HistCol, HistRow: move history up to last replayed ply
// HistCol[0], HistRow[0]: "square from" (0..7, 0..7 from square a1)
// HistCol[1], HistRow[1]: castling/capture
// HistCol[2], HistRow[2]: "square to" (0..7, 0..7 from square a1)

HistCol = new Array(3);
HistRow = new Array(3);
HistPieceId = new Array(2);
HistType = new Array(2);
HistVar = new Array();

PieceCol = new Array(2);
PieceRow = new Array(2);
PieceType = new Array(2);
PieceMoveCounter = new Array(2);

for (i=0; i<2; ++i) {
  PieceCol[i] = new Array(16);
  PieceRow[i] = new Array(16);
  PieceType[i] = new Array(16);
  PieceMoveCounter[i] = new Array(16);
  HistType[i] = new Array();
  HistPieceId[i] = new Array();
}

for (i=0; i<3; ++i) {
  HistCol[i] = new Array();
  HistRow[i] = new Array();
}

HistEnPassant = new Array();
HistEnPassant[0] = false;
HistEnPassantCol = new Array();
HistEnPassantCol[0] = -1;

HistNull = new Array();
HistNull[0] = 0;

var FenPieceName = "KQRBNP";
var PieceCode = new Array(); // IE needs array for [index]
for (i=0; i<6; i++) { PieceCode[i] = FenPieceName.charAt(i); }
var FenStringStart = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
var columnsLetters = "ABCDEFGH";
var InitialHalfMoveClock = 0;

startingSquareSize = -1;
startingImageSize = -1;

PiecePicture = new Array(2);
for (i=0; i<2; ++i) { PiecePicture[i] = new Array(6); }

var ImagePath = '';
var ImagePathOld = null;
var imageType = 'png';
var defaultImagesSize = 40;

var highlightOption = true;

var commentsIntoMoveText = true;
var commentsOnSeparateLines = false;

var pgnUrl = '';

CastlingLong  = new Array(2);
CastlingShort = new Array(2);
Moves = new Array();
MoveComments = new Array();

var MoveColor;
var MoveCount;
var PlyNumber;
var StartPly;
var CurrentPly;

var IsRotated = false;

var pgnHeaderTagRegExp       = /\[\s*(\w+)\s*"([^"]*)"\s*\]/;
var pgnHeaderTagRegExpGlobal = /\[\s*(\w+)\s*"([^"]*)"\s*\]/g;
var pgnHeaderBlockRegExp     = /\s*(\[\s*\w+\s*"[^"]*"\s*\]\s*)+/;
var dummyPgnHeader = '[x""]';
var emptyPgnHeader = '[Event ""]\n[Site ""]\n[Date ""]\n[Round ""]\n[White ""]\n[Black ""]\n[Result ""]\n\n';
var templatePgnHeader = '[Event "?"]\n[Site "?"]\n[Date "?"]\n[Round "?"]\n[White "?"]\n[Black "?"]\n[Result "?"]\n';
var alertPgnHeader = '[Event ""]\n[Site ""]\n[Date ""]\n[Round ""]\n[White ""]\n[Black ""]\n[Result ""]\n\n{error: click on the top left chessboard square for debug info}';

var pgn4webVariationRegExp       = /\[%pgn4web_variation (\d+)\]/;
var pgn4webVariationRegExpGlobal = /\[%pgn4web_variation (\d+)\]/g;

var gameSelectorHead = ' &middot;&middot;&middot;';
var gameSelectorMono = true;
var gameSelectorNum = false;
var gameSelectorNumLenght = 0;
var gameSelectorChEvent = 0;
var gameSelectorChSite = 0;
var gameSelectorChRound = 0;
var gameSelectorChWhite = 15;
var gameSelectorChBlack = 15;
var gameSelectorChResult = 0;
var gameSelectorChDate = 10;

function CheckLegality(what, plyCount) {
  var retVal, thisCol;

  if (what == '--') {
    StoreMove(plyCount);
    return true;
  }

  // castling move?
  if (what == 'O-O') {
    if (!CheckLegalityOO()) { return false; }
    for (thisCol = PieceCol[MoveColor][0]; thisCol < 7; thisCol++) {
      if (IsCheck(thisCol, MoveColor*7, MoveColor)) { return false; }
    }
    StoreMove(plyCount);
    return true;
  } else if (what == 'O-O-O') {
    if (!CheckLegalityOOO()) { return false; }
    for (thisCol = PieceCol[MoveColor][0]; thisCol > 1; thisCol--) {
      if (IsCheck(thisCol, MoveColor*7, MoveColor)) { return false; }
    }
    StoreMove(plyCount);
    return true;
  }

  // capture: "square to" occupied by opposite color piece (except en-passant)
  // promotion: "square to" moved piece different from piece
  if (!mvCapture) {
    if (Board[mvToCol][mvToRow] !== 0) { return false; }
  }
  if ((mvCapture) && (Color(Board[mvToCol][mvToRow]) != 1-MoveColor)) {
    if ((mvPiece != 6) || (!HistEnPassant[plyCount]) || (HistEnPassantCol[plyCount] != mvToCol) ||
      (mvToRow != 5-3*MoveColor)) { return false; }
  }
  if (mvIsPromotion) {
    if (mvPiece != 6) { return false; }
    if (mvPieceOnTo >= 6) { return false; }
    if (mvToRow != 7*(1-MoveColor)) { return false; }
  }

  // piece move: which same type piece could move there?
  var pieceId;
  for (pieceId = 0; pieceId < 16; ++pieceId) {
    if (PieceType[MoveColor][pieceId] == mvPiece) {
      if (mvPiece == 1) { retVal = CheckLegalityKing(pieceId); }
      else if (mvPiece == 2) { retVal = CheckLegalityQueen(pieceId); }
      else if (mvPiece == 3) { retVal = CheckLegalityRook(pieceId); }
      else if (mvPiece == 4) { retVal = CheckLegalityBishop(pieceId); }
      else if (mvPiece == 5) { retVal = CheckLegalityKnight(pieceId); }
      else if (mvPiece == 6) { retVal = CheckLegalityPawn(pieceId); }
      if (retVal) {
        mvPieceId = pieceId;
        // board updated: king check?
        StoreMove(plyCount);
        if (!IsCheck(PieceCol[MoveColor][0], PieceRow[MoveColor][0], MoveColor)) { return true; }
        else { UndoMove(plyCount); }
      }
    }
  }
  return false;
}

function CheckLegalityKing(thisKing) {
  if ((mvFromCol >= 0) && (mvFromCol != PieceCol[MoveColor][thisKing])) { return false; }
  if ((mvFromRow >= 0) && (mvFromRow != PieceRow[MoveColor][thisKing])) { return false; }
  if (Math.abs(PieceCol[MoveColor][thisKing]-mvToCol) > 1) { return false; }
  if (Math.abs(PieceRow[MoveColor][thisKing]-mvToRow) > 1) { return false; }
  return true;
}

function CheckLegalityQueen(thisQueen) {
  if ((mvFromCol >= 0) && (mvFromCol != PieceCol[MoveColor][thisQueen])) { return false; }
  if ((mvFromRow >= 0) && (mvFromRow != PieceRow[MoveColor][thisQueen])) { return false; }
  if (((PieceCol[MoveColor][thisQueen]-mvToCol) * (PieceRow[MoveColor][thisQueen]-mvToRow) !== 0) && (Math.abs(PieceCol[MoveColor][thisQueen]-mvToCol) != Math.abs(PieceRow[MoveColor][thisQueen]-mvToRow))) { return false; }
  if (!CheckClearWay(thisQueen)) { return false; }
  return true;
}

function CheckLegalityRook(thisRook) {
  if ((mvFromCol >= 0) && (mvFromCol != PieceCol[MoveColor][thisRook])) { return false; }
  if ((mvFromRow >= 0) && (mvFromRow != PieceRow[MoveColor][thisRook])) { return false; }
  if ((PieceCol[MoveColor][thisRook]-mvToCol) * (PieceRow[MoveColor][thisRook]-mvToRow) !== 0) { return false; }
  if (!CheckClearWay(thisRook)) { return false; }
  return true;
}

function CheckLegalityBishop(thisBishop) {
  if ((mvFromCol >= 0) && (mvFromCol != PieceCol[MoveColor][thisBishop])) { return false; }
  if ((mvFromRow >= 0) && (mvFromRow != PieceRow[MoveColor][thisBishop])) { return false; }
  if (Math.abs(PieceCol[MoveColor][thisBishop]-mvToCol) != Math.abs(PieceRow[MoveColor][thisBishop]-mvToRow)) { return false; }
  if (!CheckClearWay(thisBishop)) { return false; }
  return true;
}

function CheckLegalityKnight(thisKnight) {
  if ((mvFromCol >= 0) && (mvFromCol != PieceCol[MoveColor][thisKnight])) { return false; }
  if ((mvFromRow >= 0) && (mvFromRow != PieceRow[MoveColor][thisKnight])) { return false; }
  if (Math.abs(PieceCol[MoveColor][thisKnight]-mvToCol) * Math.abs(PieceRow[MoveColor][thisKnight]-mvToRow) != 2) { return false; }
  return true;
}

function CheckLegalityPawn(thisPawn) {
  if ((mvFromCol >= 0) && (mvFromCol != PieceCol[MoveColor][thisPawn])) { return false; }
  if ((mvFromRow >= 0) && (mvFromRow != PieceRow[MoveColor][thisPawn])) { return false; }
  if (Math.abs(PieceCol[MoveColor][thisPawn]-mvToCol) != mvCapture) { return false; }
  if (mvCapture) {
    if (PieceRow[MoveColor][thisPawn]-mvToRow != 2*MoveColor-1) { return false; }
  } else {
    if (PieceRow[MoveColor][thisPawn]-mvToRow == 4*MoveColor-2) {
      if (PieceRow[MoveColor][thisPawn] != 1+5*MoveColor) { return false; }
      if (Board[mvToCol][mvToRow+2*MoveColor-1] !== 0) { return false; }
    } else {
      if (PieceRow[MoveColor][thisPawn]-mvToRow != 2*MoveColor-1) { return false; }
    }
  }
  return true;
}

function RookForOOCastling(color) {
  if (CastlingShort[color] < 0) { return null; }
  if (PieceMoveCounter[color][0] > 0) { return null; }

  legal = false;
  for (thisRook = 0; thisRook < 16; thisRook++) {
    if ((PieceCol[color][thisRook] == CastlingShort[color]) &&
      (PieceCol[color][thisRook] > PieceCol[color][0]) &&
      (PieceRow[color][thisRook] == color*7) &&
      (PieceType[color][thisRook] == 3)) {
      legal = true;
      break;
    }
  }
  if (!legal) { return null; }
  if (PieceMoveCounter[color][thisRook] > 0) { return null; }

  return thisRook;
}

function CheckLegalityOO() {

  if ((thisRook = RookForOOCastling(MoveColor)) === null) { return false; }

  // check no piece between king and rook
  // clear king/rook squares for Chess960
  Board[PieceCol[MoveColor][0]][MoveColor*7] = 0;
  Board[PieceCol[MoveColor][thisRook]][MoveColor*7] = 0;
  var col = PieceCol[MoveColor][thisRook];
  if (col < 6) { col = 6; }
  while ((col > PieceCol[MoveColor][0]) || (col >= 5)) {
    if (Board[col][MoveColor*7] !== 0) { return false; }
    --col;
  }
  castleRook = thisRook;
  return true;
}

function RookForOOOCastling(color) {
  if (CastlingLong[color] < 0) { return null; }
  if (PieceMoveCounter[color][0] > 0) { return null; }

  legal = false;
  for (thisRook = 0; thisRook < 16; thisRook++) {
    if ((PieceCol[color][thisRook] == CastlingLong[color]) &&
      (PieceCol[color][thisRook] < PieceCol[color][0]) &&
      (PieceRow[color][thisRook] == color*7) &&
      (PieceType[color][thisRook] == 3)) {
      legal = true;
      break;
    }
  }
  if (!legal) { return null; }
  if (PieceMoveCounter[color][thisRook] > 0) { return null; }

  return thisRook;
}

function CheckLegalityOOO() {

  if ((thisRook = RookForOOOCastling(MoveColor)) === null) { return false; }

  // check no piece between king and rook
  // clear king/rook squares for Chess960
  Board[PieceCol[MoveColor][0]][MoveColor*7] = 0;
  Board[PieceCol[MoveColor][thisRook]][MoveColor*7] = 0;
  var col = PieceCol[MoveColor][thisRook];
  if (col > 2) { col = 2; }
  while ((col < PieceCol[MoveColor][0]) || (col <= 3)) {
   if (Board[col][MoveColor*7] !== 0) { return false; }
    ++col;
  }
  castleRook = thisRook;
  return true;
}

function CheckClearWay(thisPiece) {
  var stepCol = sign(mvToCol-PieceCol[MoveColor][thisPiece]);
  var stepRow = sign(mvToRow-PieceRow[MoveColor][thisPiece]);
  var startCol = PieceCol[MoveColor][thisPiece]+stepCol;
  var startRow = PieceRow[MoveColor][thisPiece]+stepRow;
  while ((startCol != mvToCol) || (startRow != mvToRow)) {
    if (Board[startCol][startRow] !== 0) { return false; }
    startCol += stepCol;
    startRow += stepRow;
  }
  return true;
}

function CleanMove(move) {
  move = move.replace(/[^a-zA-Z0-9#=-]*/g, ''); // patch here adding '+' after '0-8' to pass through check signs
  if (move.match(/^[Oo0]/)) { move = move.replace(/[o0]/g, 'O').replace(/O(?=O)/g, 'O-'); }
  move = move.replace(/ep/i, '');
  return move;
}

function GoToMove(thisPly, thisVar) {
  SetAutoPlay(false);
  if (typeof(thisVar) == "undefined") { thisVar = CurrentVar; }
  else {
    if (thisVar < 0) { thisVar = 0; }
    else if (thisVar >= numberOfVars) { thisVar = numberOfVars - 1; }
  }
  if (thisPly < 0) { thisPly = 0; }
  else if (thisPly >= StartPlyVar[thisVar] + PlyNumberVar[thisVar]) {
    thisPly = StartPlyVar[thisVar] + PlyNumberVar[thisVar];
  }

  if (thisVar === CurrentVar) {
    var diff = thisPly - CurrentPly;
    if (diff > 0) { MoveForward(diff); }
    else { MoveBackward(-diff); }
  } else {
    backStart = StartPly;
loopCommonPredecessor:
    for (var ii = PredecessorsVars[CurrentVar].length - 1; ii >= 0; ii--) {
      for (var jj = PredecessorsVars[thisVar].length - 1; jj >= 0; jj--) {
        if (PredecessorsVars[CurrentVar][ii] === PredecessorsVars[thisVar][jj]) {
          backStart = Math.min(PredecessorsVars[CurrentVar][ii+1] ? StartPlyVar[PredecessorsVars[CurrentVar][ii+1]] : CurrentPly, PredecessorsVars[thisVar][jj+1] ? StartPlyVar[PredecessorsVars[thisVar][jj+1]] : thisPly);
          break loopCommonPredecessor;
        }
      }
    }
    MoveBackward(CurrentPly - backStart, true);
    MoveForward(thisPly - backStart, thisVar);
  }
}

function SetShortcutKeysEnabled(onOff) {
  shortcutKeysEnabled = onOff;
}

function interactivelyToggleShortcutKeys() {
  if (confirm("Shortcut keys currently " + (shortcutKeysEnabled ? "enabled" : "disabled") + ".\nToggle shortcut keys to " + (shortcutKeysEnabled ? "DISABLED" : "ENABLED") + "?")) {
    SetShortcutKeysEnabled(!shortcutKeysEnabled);
  }
}

function SetCommentsIntoMoveText(onOff) {
  commentsIntoMoveText = onOff;
}

function SetCommentsOnSeparateLines(onOff) {
  commentsOnSeparateLines = onOff;
}

function SetAutostartAutoplay(onOff) {
  autostartAutoplay = onOff;
}

function SetAutoplayNextGame(onOff) {
  autoplayNextGame = onOff;
}

function SetInitialHalfmove(number_or_string, always) {
  alwaysInitialHalfmove = (always === true);
  if (number_or_string === undefined) { initialHalfmove = 0; return; }
  initialHalfmove = number_or_string;
  if ((typeof number_or_string == "string") &&
    (number_or_string.match(/^(start|end|random|comment)$/))) { return; }
  if ((initialHalfmove = parseInt(initialHalfmove,10)) == NaN) { initialHalfmove = 0; }
}

function SetInitialVariation(number) {
  initialVariation = isNaN(number = parseInt(number, 10)) ? 0 : number;
}

function SetInitialGame(number_or_string) {
  initialGame = typeof(number_or_string) == "undefined" ? 1 : number_or_string;
}

function randomGameRandomPly() {
  if (numberOfGames > 1) {
    var oldInitialHalfmove = initialHalfmove;
    var oldAlwaysInitialHalfmove = alwaysInitialHalfmove;
    SetInitialHalfmove("random", true);
    Init(Math.floor(Math.random()*numberOfGames));
    SetInitialHalfmove(oldInitialHalfmove, oldAlwaysInitialHalfmove);
  }
}


// clock detection: DGT format [%clk 01:02]

function clockFromComment(plyNum) {
  return customPgnCommentTag("clk", null, plyNum);
}

function clockFromHeader(whiteToMove) {
  clockHeaderString = customPgnHeaderTag("Clock") + "";
  if (tagValues = clockHeaderString.match("^" + (whiteToMove ? "W" : "B") + "/(.*)$")) {
    return tagValues[1];
  } else { return null; }
}

function HighlightLastMove() {
  var anchorName, text;

  undoStackStore();

  // remove highlighting from old anchor
  if (oldAnchorName) {
    if (theObj = document.getElementById(oldAnchorName)) {
      theObj.className = ( oldAnchorName.match(/Var0Mv/) ? 'move' : 'variation') + ' notranslate';
    }
  }

  // find halfmove to be highlighted, negative for starting position (nothing to highlight)
  var showThisMove = CurrentPly - 1;
  if (showThisMove > StartPlyVar[CurrentVar] + PlyNumberVar[CurrentVar]) { showThisMove = StartPlyVar[CurrentVar] + PlyNumberVar[CurrentVar]; }

  if (theShowCommentTextObject = document.getElementById("GameLastComment")) {
    if (commentsIntoMoveText) {
    variationTextDepth = CurrentVar === 0 ? 0 : 1;
    text = '<SPAN CLASS="comment">' +
      strippedMoveComment(showThisMove+1, CurrentVar, true).replace(/\sID="[^"]*"/g, '') +
      '</SPAN>';
    } else { text = ''; }
    theShowCommentTextObject.innerHTML = text;
  }

  // show side to move
  whiteToMove = ((showThisMove+1)%2 === 0);
  text = whiteToMove ? 'white' : 'black';

  if (theObj = document.getElementById("GameSideToMove"))
  { theObj.innerHTML = text; }

  // show clock if any
  lastMoverClockObject = document.getElementById(whiteToMove ?
    "GameBlackClock" : "GameWhiteClock");
  initialLastMoverClock = whiteToMove ?
    gameInitialBlackClock[currentGame] : gameInitialWhiteClock[currentGame];
  beforeLastMoverClockObject = document.getElementById(whiteToMove ?
    "GameWhiteClock" : "GameBlackClock");
  initialBeforeLastMoverClock = whiteToMove ?
    gameInitialWhiteClock[currentGame] : gameInitialBlackClock[currentGame];

  if (lastMoverClockObject) {
    clockString = ((showThisMove+1 === StartPly+PlyNumber) &&
      ((!LiveBroadcastDemo) || (gameResult[currentGame] !== "*"))) ?
      clockFromHeader(!whiteToMove) : null;
    if (clockString === null) {
      clockString = showThisMove+1 > StartPly ?
        clockFromComment(showThisMove+1) : initialLastMoverClock;
      if (!clockString && (CurrentPly === StartPly+PlyNumber)) {
        // support for time info in the last comment as { White Time: 0h:12min Black Time: 1h:23min }
        clockRegExp = new RegExp((whiteToMove ? "Black" : "White") + "\\s+Time:\\s*(\\S+)", "i");
        if (clockMatch = strippedMoveComment(StartPly+PlyNumber).match(clockRegExp)) {
          clockString = clockMatch[1];
        }
      }
    }
    lastMoverClockObject.innerHTML = clockString;
  }
  if (beforeLastMoverClockObject) {
    clockString = ((showThisMove+1 === StartPly+PlyNumber) &&
      ((!LiveBroadcastDemo) || (gameResult[currentGame] !== "*"))) ?
      clockFromHeader(whiteToMove) : null;
    if (clockString === null) {
      clockString = showThisMove > StartPly ?
        clockFromComment(showThisMove) : initialBeforeLastMoverClock;
      if (!clockString && (CurrentPly === StartPly+PlyNumber)) {
        // support for time info in the last comment as { White Time: 0h:12min Black Time: 1h:23min }
        clockRegExp = new RegExp((whiteToMove ? "White" : "Black") + "\\s+Time:\\s*(\\S+)", "i");
        if (clockMatch = strippedMoveComment(StartPly+PlyNumber).match(clockRegExp)) {
          clockString = clockMatch[1];
        }
      }
    }
    beforeLastMoverClockObject.innerHTML = clockString;
  }

  if (lastMoverClockObject && beforeLastMoverClockObject) {
    if (lastMoverClockObject.innerHTML && !beforeLastMoverClockObject.innerHTML) {
      beforeLastMoverClockObject.innerHTML = "-";
    } else if (!lastMoverClockObject.innerHTML && beforeLastMoverClockObject.innerHTML) {
      lastMoverClockObject.innerHTML = "-";
    }
  }

  // show next move
  var theShowMoveTextObject;
  if (theShowMoveTextObject = document.getElementById("GameNextMove")) {
    if (CurrentVar === 0 && showThisMove + 1 >= StartPly + PlyNumber) {
      text = '<SPAN CLASS="move notranslate">' + gameResult[currentGame] + '</SPAN>';
    } else if (typeof(Moves[showThisMove+1]) == "undefined") {
      text = "";
    } else {
      text = printMoveText(showThisMove+1, CurrentVar, (CurrentVar !== 0), true, false);
    }
    theShowMoveTextObject.innerHTML = text;
  }

  // show next variations
  if (theShowMoveTextObject = document.getElementById("GameNextVariations")) {
    text = '';
    if (commentsIntoMoveText) {
      var childVars = childrenVars(showThisMove+1, CurrentVar);
      for (ii = 0; ii < childVars.length; ii++) {
        if (childVars[ii] !== CurrentVar) {
          text += ' ' + printMoveText(showThisMove+1, childVars[ii], (childVars[ii] !== 0), true, false);
        }
      }
    }
    theShowMoveTextObject.innerHTML = text;
  }

  // show last move
  if (theShowMoveTextObject = document.getElementById("GameLastMove")) {
    if ((showThisMove >= StartPly) && Moves[showThisMove]) {
      text = printMoveText(showThisMove, CurrentVar, (CurrentVar !== 0), true, false);
    } else if (showThisMove === StartPly - 1) {
      text = '<SPAN CLASS="' + (CurrentVar > 0 ? 'variation' : 'move') + ' notranslate">' +
        (Math.floor((showThisMove+1)/2) + 1) + (((showThisMove+1) % 2) ? "..." : ".") +
        '</SPAN>';
    } else { text = ''; }
    theShowMoveTextObject.innerHTML = text;
  }

  // show last variations
  if (theShowMoveTextObject = document.getElementById("GameLastVariations")) {
    text = '';
    if (commentsIntoMoveText) {
      var siblingVars = childrenVars(showThisMove, HistVar[showThisMove]);
      for (ii = 0; ii < siblingVars.length; ii++) {
        if (siblingVars[ii] !== CurrentVar) {
          text += ' ' + printMoveText(showThisMove, siblingVars[ii], (siblingVars[ii] !== 0), true, false);
        }
      }
    }
    theShowMoveTextObject.innerHTML = text;
  }

  if (showThisMove >= (StartPlyVar[CurrentVar]-1)) {
    anchorName = 'Var' + CurrentVar + 'Mv' + (showThisMove + 1);
    if (theObj = document.getElementById(anchorName)) {
      theObj.className = (CurrentVar ? 'variation variationOn' : 'move moveOn') + ' notranslate';
    }
    oldAnchorName = anchorName;

    if (highlightOption) {
      if ((showThisMove < StartPly) || HistNull[showThisMove]) {
        highlightColFrom = highlightRowFrom = -1;
        highlightColTo   = highlightRowTo   = -1;
      } else {
        highlightColFrom = HistCol[0][showThisMove] === undefined ? -1 : HistCol[0][showThisMove];
        highlightRowFrom = HistRow[0][showThisMove] === undefined ? -1 : HistRow[0][showThisMove];
        highlightColTo   = HistCol[2][showThisMove] === undefined ? -1 : HistCol[2][showThisMove];
        highlightRowTo   = HistRow[2][showThisMove] === undefined ? -1 : HistRow[2][showThisMove];
      }
      highlightMove(highlightColFrom, highlightRowFrom, highlightColTo, highlightRowTo);
    }
  }
}

function SetHighlightOption(on) {
  highlightOption = on;
}

function SetHighlight(on) {
  SetHighlightOption(on);
  if (on) { HighlightLastMove(); }
  else { highlightMove(-1, -1, -1, -1); }
}

var lastColFromHighlighted = -1;
var lastRowFromHighlighted = -1;
var lastColToHighlighted = -1;
var lastRowToHighlighted = -1;
function highlightMove(colFrom, rowFrom, colTo, rowTo) {
  highlightSquare(lastColFromHighlighted, lastRowFromHighlighted, false);
  highlightSquare(lastColToHighlighted, lastRowToHighlighted, false);
  if ( highlightSquare(colFrom, rowFrom, true) ) {
    lastColFromHighlighted = colFrom;
    lastRowFromHighlighted = rowFrom;
  } else { lastColFromHighlighted = lastRowFromHighlighted = -1; }
  if ( highlightSquare(colTo, rowTo, true) ) {
    lastColToHighlighted = colTo;
    lastRowToHighlighted = rowTo;
  } else { lastColToHighlighted = lastRowToHighlighted = -1; }
}

function highlightSquare(col, row, on) {
  if ((col === undefined) || (row === undefined)) { return false; }
  if (!SquareOnBoard(col, row)) { return false; }
  if (IsRotated) { trow = row; tcol = 7 - col; }
  else { trow = 7 - row; tcol = col; }
  if (!(theObj = document.getElementById('tcol' + tcol + 'trow' + trow))) { return false; }
  if (on) { theObj.className = (trow+tcol)%2 === 0 ? "highlightWhiteSquare" : "highlightBlackSquare"; }
  else { theObj.className = (trow+tcol)%2 === 0 ? "whiteSquare" : "blackSquare"; }
  return true;
}

var undoStackMax = 1000;
var undoStackGame = new Array(undoStackMax);
var undoStackVar = new Array(undoStackMax);
var undoStackPly = new Array(undoStackMax);
var undoStackStart = 0;
var undoStackCurrent = 0;
var undoStackEnd = 0;
var undoRedoInProgress = false;

function undoStackReset() {
  undoStackGame = new Array(undoStackMax);
  undoStackVar = new Array(undoStackMax);
  undoStackPly = new Array(undoStackMax);
  undoStackStart = undoStackCurrent = undoStackEnd = 0;
}

function undoStackStore() {
  if (undoRedoInProgress) { return false; }
  if ((undoStackStart === undoStackCurrent) ||
      (currentGame !== undoStackGame[undoStackCurrent]) ||
      (CurrentVar !== undoStackVar[undoStackCurrent]) ||
      (CurrentPly !== undoStackPly[undoStackCurrent])) {
    undoStackCurrent = (undoStackCurrent + 1) % undoStackMax;
    undoStackGame[undoStackCurrent] = currentGame;
    undoStackVar[undoStackCurrent] = CurrentVar;
    undoStackPly[undoStackCurrent] = CurrentPly;
    undoStackEnd = undoStackCurrent;
    if (undoStackStart === undoStackCurrent) { undoStackStart = (undoStackStart + 1) % undoStackMax; }
  }
  return true;
}

function undoStackUndo() {
  if ((undoStackCurrent - 1 + undoStackMax) % undoStackMax === undoStackStart) { return false; }
  undoRedoInProgress = true;
  undoStackCurrent = (undoStackCurrent - 1 + undoStackMax) % undoStackMax;
  if (undoStackGame[undoStackCurrent] !== currentGame) { Init(undoStackGame[undoStackCurrent]); }
  GoToMove(undoStackPly[undoStackCurrent], undoStackVar[undoStackCurrent]);
  undoRedoInProgress = false;
  return true;
}

function undoStackRedo() {
  if (undoStackCurrent === undoStackEnd) { return false; }
  undoRedoInProgress = true;
  undoStackCurrent = (undoStackCurrent + 1) % undoStackMax;
  if (undoStackGame[undoStackCurrent] !== currentGame) { Init(undoStackGame[undoStackCurrent]); }
  GoToMove(undoStackPly[undoStackCurrent], undoStackVar[undoStackCurrent]);
  undoRedoInProgress = false;
  return true;
}


// align to chrome-extension/background.html
function fixCommonPgnMistakes(text) {
  text = text.replace(/[\u00A0\u180E\u2000-\u200A\u202F\u205F\u3000]/g," "); // some "space" to plain space
  text = text.replace(/\u00BD/g,"1/2"); // "half fraction" to "1/2"
  text = text.replace(/[\u2010-\u2015]/g,"-"); // "hyphens" to "-"
  text = text.replace(/\u2024/g,"."); // "one dot leader" to "."
  text = text.replace(/[\u2025-\u2026]/g,"..."); // "two dot leader" and "ellipsis" to "..."
  text = text.replace(/\\"/g,"'"); // fix parsing headers like: [Opening "King\"s Indian Attack"]
  return text;
}

function fullPgnGame(gameNum) {
  res = pgnHeader[gameNum] ? pgnHeader[gameNum].replace(/^[^[]*/g, "") : "";
  res = res.replace(/\[\s*(\w+)\s*"([^"]*)"\s*\][^[]*/g, '[$1 "$2"]\n');
  res += "\n";
  res += pgnGame[gameNum] ? pgnGame[gameNum].replace(/(^[\s]*|[\s]*$)/g, "") : "";
  return res;
}

function pgnGameFromPgnText(pgnText) {

  var headMatch, prevHead, newHead, startNew, afterNew, lastOpen, checkedGame, validHead;

  pgnText = fixCommonPgnMistakes(pgnText);

  // avoid html injection
  pgnText = pgnText.replace(/</g, "&lt;");
  pgnText = pgnText.replace(/>/g, "&gt;");

  // PGN standard: ignore lines starting with %
  pgnText = pgnText.replace(/(^|\n)%.*(\n|$)/g, "\n");

  numberOfGames = 0;
  checkedGame = "";
  while (headMatch = pgnHeaderBlockRegExp.exec(pgnText)) {
    newHead = headMatch[0];
    startNew = pgnText.indexOf(newHead);
    afterNew = startNew + newHead.length;
    if (prevHead) {
      checkedGame += pgnText.slice(0, startNew);
      validHead = ((lastOpen = checkedGame.lastIndexOf("{")) < 0) || (checkedGame.lastIndexOf("}")) > lastOpen;
      if (validHead) {
        pgnHeader[numberOfGames] = prevHead;
        pgnGame[numberOfGames++] = checkedGame;
        checkedGame = "";
      } else {
        checkedGame += newHead;
      }
    } else {
      validHead = true;
    }
    if (validHead) { prevHead = newHead; }
    pgnText = pgnText.slice(afterNew);
  }
  if (prevHead) {
    pgnHeader[numberOfGames] = prevHead;
    checkedGame += pgnText;
    pgnGame[numberOfGames++] = checkedGame;
  }

  return (numberOfGames > 0);
}


function pgnGameFromHttpRequest(httpResponseData) {

  if (pgnUrl && pgnUrl.match(/\.zip(\?|#|$)/i)) {
    var unzippedPgnText = "";
    try {
      // requires js-unzip/js-unzip.js and js-unzip/js-inflate.js
      var unzipper = new JSUnzip(httpResponseData);
      if (unzipper.isZipFile()) {
        unzipper.readEntries();
        for (u in unzipper.entries) {
          if (unzipper.entries[u].fileName.match(/\.pgn$/i)) {
            switch (unzipper.entries[u].compressionMethod) {
              case 0:
                unzippedPgnText += "\n" + unzipper.entries[u].data + "\n";
                break;
              case 8:
                unzippedPgnText += "\n" + JSInflate.inflate(unzipper.entries[u].data) + "\n";
                break;
              default:
                myAlert("warning: unsupported compression method " + unzipper.entries[u].compressionMethod + " for ZIP archive at URL\n" + pgnUrl, false);
                break;
            }
          }
        }
        if (!unzippedPgnText) { myAlert("error: no PGN games found in ZIP archive at URL\n" + pgnUrl, true); }
      } else { myAlert("error: invalid ZIP archive at URL\n" + pgnUrl, true); }
      if (!unzippedPgnText) { unzippedPgnText = alertPgnHeader; }
    } catch(e) {
      myAlert("error: missing unzip library or unzip error for ZIP archive at URL\n" + pgnUrl, true);
      unzippedPgnText = httpResponseData; // passing through the data for backward compatibility
    }
  } else {
    unzippedPgnText = httpResponseData;
  }

  return pgnGameFromPgnText(unzippedPgnText);
}

var http_request_last_processed_id = 0;
function updatePgnFromHttpRequest(this_http_request, this_http_request_id) {

  if (this_http_request.readyState != 4) { return; }

  if (this_http_request_id < http_request_last_processed_id) { return; }
  else { http_request_last_processed_id = this_http_request_id; }

  if ((this_http_request.status == 200) || (this_http_request.status === 0) || (this_http_request.status == 304)) {

    if (this_http_request.status == 304) {
      if (LiveBroadcastDelay > 0) {
        loadPgnFromPgnUrlResult = LOAD_PGN_UNMODIFIED;
      } else {
        myAlert('error: unmodified PGN URL when not in live mode');
        loadPgnFromPgnUrlResult = LOAD_PGN_FAIL;
      }

// patch Opera's failure reporting 304 status
    } else if (window.opera && (!this_http_request.responseText) && (this_http_request.status === 0)) {
      this_http_request.abort();
      loadPgnFromPgnUrlResult = LOAD_PGN_UNMODIFIED;
// end of patch

    } else if (!this_http_request.responseText) {
      myAlert('error: no data received from PGN URL\n' + pgnUrl, true);
      loadPgnFromPgnUrlResult = LOAD_PGN_FAIL;
    } else if (!pgnGameFromHttpRequest(this_http_request.responseText)) {
      myAlert('error: no games found at PGN URL\n' + pgnUrl, true);
      loadPgnFromPgnUrlResult = LOAD_PGN_FAIL;
    } else {
      if (LiveBroadcastDelay > 0) {
        LiveBroadcastLastModifiedHeader = this_http_request.getResponseHeader("Last-Modified");
        if (LiveBroadcastLastModifiedHeader) {
          LiveBroadcastLastModified = new Date(LiveBroadcastLastModifiedHeader);
          LiveBroadcastLastReceivedLocal = (new Date()).toLocaleString();
        }
        else { LiveBroadcastLastModified_Reset(); }
      }
      loadPgnFromPgnUrlResult = LOAD_PGN_OK;
    }

  } else {
    myAlert('error: failed reading PGN URL\n' + pgnUrl, true);
    loadPgnFromPgnUrlResult = LOAD_PGN_FAIL;
  }

  if (LiveBroadcastDemo && (loadPgnFromPgnUrlResult == LOAD_PGN_UNMODIFIED)) {
    loadPgnFromPgnUrlResult = LOAD_PGN_OK;
  }

  loadPgnCheckingLiveStatus(loadPgnFromPgnUrlResult);
}

var LOAD_PGN_FAIL = 0;
var LOAD_PGN_OK = 1;
var LOAD_PGN_UNMODIFIED = 2;
function loadPgnCheckingLiveStatus(loadPgnResult) {

  switch (loadPgnResult) {

    case LOAD_PGN_OK:
      if (LiveBroadcastDelay > 0) {
        firstStart = true;
        oldParseLastMoveError = ParseLastMoveError;
        if (!LiveBroadcastStarted) {
          LiveBroadcastStarted = true;
        } else {
          oldGameWhite = gameWhite[currentGame];
          oldGameBlack = gameBlack[currentGame];
          oldGameEvent = gameEvent[currentGame];
          oldGameRound = gameRound[currentGame];
          oldGameSite  = gameSite[currentGame];
          oldGameDate  = gameDate[currentGame];

          initialGame = currentGame + 1;

          LiveBroadcastOldCurrentVar = CurrentVar;
          LiveBroadcastOldCurrentPly = CurrentPly;
          LiveBroadcastOldCurrentPlyLast = (CurrentVar === 0 && CurrentPly === StartPlyVar[0] + PlyNumberVar[0]);

          oldAutoplay = isAutoPlayOn;
          if (isAutoPlayOn) { SetAutoPlay(false); }

          LoadGameHeaders();
          LiveBroadcastFoundOldGame = false;
          for (ii=0; ii<numberOfGames; ii++) {
            LiveBroadcastFoundOldGame =
              (gameWhite[ii]==oldGameWhite) && (gameBlack[ii]==oldGameBlack) &&
              (gameEvent[ii]==oldGameEvent) && (gameRound[ii]==oldGameRound) &&
              (gameSite[ii] ==oldGameSite ) && (gameDate[ii] ==oldGameDate );
            if (LiveBroadcastFoundOldGame) { break; }
          }
          if (LiveBroadcastFoundOldGame) { initialGame = ii + 1; }

          if (LiveBroadcastFoundOldGame) {
            oldInitialVariation = initialVariation;
            oldInitialHalfmove = initialHalfmove;
            initialVariation = CurrentVar;
            if (LiveBroadcastSteppingMode) {
              initialHalfmove = (LiveBroadcastOldCurrentPlyLast || oldParseLastMoveError) ?
                LiveBroadcastOldCurrentPly+1 : LiveBroadcastOldCurrentPly;
            } else {
              initialHalfmove = (LiveBroadcastOldCurrentPlyLast || oldParseLastMoveError) ?
                "end" : LiveBroadcastOldCurrentPly;
            }
          }
        }
      }

      undoStackReset();
      Init();

      if (LiveBroadcastDelay > 0) {
        if (LiveBroadcastFoundOldGame) {
          initialHalfmove = oldInitialHalfmove;
          initialVariation = oldInitialVariation;
        }
        checkLiveBroadcastStatus();
      }

      customFunctionOnPgnTextLoad();

      if (LiveBroadcastDelay > 0) {
        if (LiveBroadcastFoundOldGame) {
          if (LiveBroadcastSteppingMode) {
            if (oldAutoplay || LiveBroadcastOldCurrentPlyLast || oldParseLastMoveError) { SetAutoPlay(true); }
          } else {
            if (oldAutoplay) { SetAutoPlay(true); }
          }
        }
      }

      break;

    case LOAD_PGN_UNMODIFIED:
      if (LiveBroadcastDelay > 0) {
        checkLiveBroadcastStatus();
      }
      break;

    case LOAD_PGN_FAIL:
    default:
      if (LiveBroadcastDelay === 0) {
        pgnGameFromPgnText(alertPgnHeader);
        undoStackReset();
        Init();
        customFunctionOnPgnTextLoad();
      } else { // live broadcast: wait for live show start
        if (!LiveBroadcastStarted) {
          pgnGameFromPgnText(LiveBroadcastPlaceholderPgn);
          firstStart = true;
          undoStackReset();
          Init();
          checkLiveBroadcastStatus();
          customFunctionOnPgnTextLoad();
        } else { checkLiveBroadcastStatus(); }
      }
      break;

  }

  if (LiveBroadcastDelay > 0) { restartLiveBroadcastTimeout(); }
}

var http_request_last_id = 0;
function loadPgnFromPgnUrl(pgnUrl) {

  LiveBroadcastLastRefreshedLocal = (new Date()).toLocaleString();

  var http_request = false;
  if (window.XMLHttpRequest) { // not IE
    http_request = new XMLHttpRequest();
    if (http_request.overrideMimeType) {
      http_request.overrideMimeType('text/plain; charset=x-user-defined');
    }
  } else if (window.ActiveXObject) { // IE
    try { http_request = new ActiveXObject("Msxml2.XMLHTTP"); }
    catch (e) {
      try { http_request = new ActiveXObject("Microsoft.XMLHTTP"); }
      catch (e) {
        myAlert('error: XMLHttpRequest unavailable for PGN URL\n' + pgnUrl, true);
        return false;
      }
    }
  }
  if (!http_request) {
    myAlert('error: failed creating XMLHttpRequest for PGN URL\n' + pgnUrl, true);
    return false;
  }

  var http_request_id = http_request_last_id++;
  http_request.onreadystatechange = function () { updatePgnFromHttpRequest(http_request, http_request_id); };

  try {
    // anti-caching #1
    if ((LiveBroadcastDelay > 0) && (pgnUrl.indexOf("?") == -1) && (pgnUrl.indexOf("#") == -1)) {
      urlRandomizer = "?noCache=" + (0x1000000000 + Math.floor((Math.random() * 0xF000000000))).toString(16).toUpperCase();
    } else { urlRandomizer = ""; }
    http_request.open("GET", pgnUrl + urlRandomizer);
    // anti-caching #2
    if (LiveBroadcastDelay > 0) {
      http_request.setRequestHeader( "If-Modified-Since", LiveBroadcastLastModifiedHeader );
    }
    http_request.send(null);
  } catch(e) {
    myAlert('error: failed sending XMLHttpRequest for PGN URL\n' + pgnUrl, true);
    return false;
  }

  return true;
}

function SetPgnUrl(url) {
  pgnUrl = url;
}


function LiveBroadcastLastModified_Reset() {
  LiveBroadcastLastModified = new Date(0);
  LiveBroadcastLastModifiedHeader = LiveBroadcastLastModified.toUTCString();
}

function LiveBroadcastLastReceivedLocal_Reset() {
  LiveBroadcastLastReceivedLocal = 'unavailable';
}

function LiveBroadcastLastModified_ServerTime() {
  return LiveBroadcastLastModified.getTime() === 0 ? 'unavailable' : LiveBroadcastLastModifiedHeader;
}

function pauseLiveBroadcast() {
  if (LiveBroadcastDelay === 0) { return; }
  LiveBroadcastPaused = true;
  clearTimeout(LiveBroadcastInterval);
  LiveBroadcastInterval = null;
}

function restartLiveBroadcast() {
  if (LiveBroadcastDelay === 0) { return; }
  LiveBroadcastPaused = false;
  refreshPgnSource();
}

function checkLiveBroadcastStatus() {
  var liveBroadcastStatusTitle;
  var tick = "&nbsp;" + (LiveBroadcastTicker % 2 ? "<>" : "><") + "&nbsp;";

  if (LiveBroadcastDelay === 0) { return; }

  // broadcast started yet?
  if (LiveBroadcastStarted === false || typeof(pgnHeader) == "undefined" || (numberOfGames == 1 && gameEvent[0] == LiveBroadcastPlaceholderEvent)) {
    // no
    LiveBroadcastEnded = false;
    LiveBroadcastGamesRunning = 0;
    LiveBroadcastStatusString = "0 " + tick + " 0";
    liveBroadcastStatusTitle = "live broadcast yet to start";
  } else {
    // yes
    var lbgr = 0;
    for (ii=0; ii<numberOfGames; ii++) {
      if (gameResult[ii].indexOf('*') >= 0) { lbgr++; }
    }
    LiveBroadcastEnded = (lbgr === 0);
    LiveBroadcastGamesRunning = lbgr;
    LiveBroadcastStatusString = lbgr + " " + tick + " " + numberOfGames;
    liveBroadcastStatusTitle = LiveBroadcastEnded ? "live broadcast ended" : lbgr + " live game" + (lbgr > 1 ? "s" : "") + " out of " + numberOfGames;
  }

  if (theObj = document.getElementById("GameLiveStatus")) {
    theObj.innerHTML = LiveBroadcastStatusString;
    theObj.title = liveBroadcastStatusTitle;
  }

  if (theObj = document.getElementById("GameLiveLastRefreshed")) { theObj.innerHTML = LiveBroadcastLastRefreshedLocal; }
  if (theObj = document.getElementById("GameLiveLastReceived")) { theObj.innerHTML = LiveBroadcastLastReceivedLocal; }
  if (theObj = document.getElementById("GameLiveLastModifiedServer")) { theObj.innerHTML = LiveBroadcastLastModified_ServerTime(); }

  customFunctionOnCheckLiveBroadcastStatus();
}

function restartLiveBroadcastTimeout() {
  if (LiveBroadcastDelay === 0) { return; }
  if (LiveBroadcastInterval) { clearTimeout(LiveBroadcastInterval); LiveBroadcastInterval = null; }
  needRestart = (!LiveBroadcastEnded);
  if ((needRestart === true) && (!LiveBroadcastPaused)) {
    LiveBroadcastInterval = setTimeout("refreshPgnSource()", LiveBroadcastDelay * 60000);
  }
  LiveBroadcastTicker++;
}

var LiveBroadcastFoundOldGame = false;
var LiveBroadcastOldCurrentVar;
var LiveBroadcastOldCurrentPly;
var LiveBroadcastOldCurrentPlyLast = false;
function refreshPgnSource() {
  if (LiveBroadcastDelay === 0) { return; }
  if (LiveBroadcastInterval) { clearTimeout(LiveBroadcastInterval); LiveBroadcastInterval = null; }
  if (LiveBroadcastDemo) {
    addedPly = 0;
    for (ii=0;ii<numberOfGames;ii++) {
      rnd = Math.random();
      if      (rnd <= 0.05) { newPly = 3; } //  5%
      else if (rnd <= 0.20) { newPly = 2; } // 15%
      else if (rnd <= 0.60) { newPly = 1; } // 40%
      else                  { newPly = 0; } // 40%
      if (gameDemoMaxPly[ii] <= gameDemoLength[ii]) {
        gameDemoMaxPly[ii] += newPly;
        addedPly += newPly;
      }
    }
    if (addedPly > 0) { LiveBroadcastLastReceivedLocal = (new Date()).toLocaleString(); }
  }

  if (pgnUrl) {
    loadPgnFromPgnUrl(pgnUrl);
  } else if ( document.getElementById("pgnText") ) {
    loadPgnFromTextarea("pgnText");
  } else {
    pgnGameFromPgnText(alertPgnHeader);
    undoStackReset();
    Init();
    customFunctionOnPgnTextLoad();
    myAlert('error: missing PGN URL location and pgnText object in the HTML file', true);
  }
}

function loadPgnFromTextarea(textareaId) {

  LiveBroadcastLastRefreshedLocal = (new Date()).toLocaleString();

  if (!(theObj = document.getElementById(textareaId))) {
    myAlert('error: missing ' + textareaId + ' textarea object in the HTML file', true);
    loadPgnFromTextareaResult = LOAD_PGN_FAIL;
  } else {
    if (document.getElementById(textareaId).tagName.toLowerCase() == "textarea") {
      tmpText = document.getElementById(textareaId).value;
    } else { // compatibility with pgn4web up to 1.77: <span> used for pgnText
      tmpText = document.getElementById(textareaId).innerHTML;
      // fixes browser issue removing \n from innerHTML
      if (tmpText.indexOf('\n') < 0) { tmpText = tmpText.replace(/((\[[^\[\]]*\]\s*)+)/g, "\n$1\n"); }
      // fixes browser issue replacing quotes with &quot; e.g. blackberry
      if (tmpText.indexOf('"') < 0) { tmpText = tmpText.replace(/(&quot;)/g, '"'); }
    }

    // no header: add emptyPgnHeader
    if (pgnHeaderTagRegExp.test(tmpText) === false) { tmpText = emptyPgnHeader + tmpText; }

    if ( pgnGameFromPgnText(tmpText) ) {
      loadPgnFromTextareaResult = LOAD_PGN_OK;
      LiveBroadcastLastReceivedLocal = (new Date()).toLocaleString();
    } else {
      myAlert('error: no games found in ' + textareaId + 'object in the HTML file');
      loadPgnFromTextareaResult = LOAD_PGN_FAIL;
    }
  }

  loadPgnCheckingLiveStatus(loadPgnFromTextareaResult);
}

function createBoard() {

  if (theObj = document.getElementById("GameBoard")) {
    theObj.innerHTML = '<DIV STYLE="font-size: small; font-family: sans-serif; ' +
      'padding: 10px; text-align: center;">' +
      '...loading PGN data<br />please wait...</DIV>';
  }

  if (pgnUrl) {
    loadPgnFromPgnUrl(pgnUrl);
  } else if ( document.getElementById("pgnText") ) {
    loadPgnFromTextarea("pgnText");
  } else {
    pgnGameFromPgnText(alertPgnHeader);
    undoStackReset();
    Init();
    customFunctionOnPgnTextLoad();
    myAlert('error: missing PGN URL location or pgnText in the HTML file', true);
  }
}

function setCurrentGameFromInitialGame() {
  switch (initialGame) {
    case "first":
      currentGame = 0;
      break;
    case "last":
      currentGame = numberOfGames - 1;
      break;
    case "random":
      currentGame = Math.floor(Math.random()*numberOfGames);
      break;
    default:
      if (isNaN(parseInt(initialGame,10))) {
        currentGame = gameNumberSearchPgn(initialGame, false, true);
        if (!currentGame) { currentGame = 0; }
      } else {
        initialGame = parseInt(initialGame,10);
        initialGame = initialGame < 0 ? -Math.floor(-initialGame) : Math.floor(initialGame);
        if (initialGame < -numberOfGames) { currentGame = 0; }
        else if (initialGame < 0) { currentGame = numberOfGames + initialGame; }
        else if (initialGame === 0) { currentGame = Math.floor(Math.random()*numberOfGames); }
        else if (initialGame <= numberOfGames) { currentGame = (initialGame - 1); }
        else { currentGame = numberOfGames - 1; }
      }
      break;
  }
}

function GoToInitialHalfmove() {
  var iv, ih;
  if (initialVariation < 0) { iv = Math.max(numberOfVars + initialVariations, 0); }
  else { iv = Math.min(initialVariation, numberOfVars - 1); }

  switch (initialHalfmove) {
    case "start":
      GoToMove(0, iv);
      break;
    case "end":
      GoToMove(StartPlyVar[iv] + PlyNumberVar[iv], iv);
      break;
    case "random":
      GoToMove(StartPlyVar[iv] + Math.floor(Math.random()*(StartPlyVar[iv] + PlyNumberVar[iv])), iv);
      break;
    case "comment":
    case "variation":
      GoToMove(0, iv);
      MoveToNextComment(initialHalfmove == "variation");
      break;
    default:
      if (isNaN(initialHalfmove = parseInt(initialHalfmove, 10))) { initialHalfmove = 0; }
      if (initialHalfmove < 0) { ih = Math.max(StartPlyVar[iv] + PlyNumberVar[iv] + 1 + initialHalfmove, 0); }
      else { ih = Math.min(initialHalfmove, StartPlyVar[iv] + PlyNumberVar[iv]); }
      GoToMove(ih, iv);
      break;
  }
}

function Init(nextGame) {

  if (nextGame !== undefined) {
    if ((!isNaN(nextGame)) && (nextGame >= 0) && (nextGame < numberOfGames)) {
      currentGame = parseInt(nextGame,10);
    } else { return; }
  }

  if (isAutoPlayOn) { SetAutoPlay(false); }

  InitImages();
  if (firstStart) {
    LoadGameHeaders();
    setCurrentGameFromInitialGame();
  }

  if ((gameSetUp[currentGame] !== undefined) && (gameSetUp[currentGame] != "1")) { InitFEN(); }
  else { InitFEN(gameFEN[currentGame]); }

  OpenGame(currentGame);

  CurrentPly = StartPly;
  if (firstStart || alwaysInitialHalfmove) {
    GoToInitialHalfmove();
    setTimeout("autoScrollToCurrentMoveIfEnabled();", Math.min(666, 0.9 * Delay));
  } else {
    synchMoves();
    RefreshBoard();
    HighlightLastMove();
    autoScrollToCurrentMoveIfEnabled();
    // customFunctionOnMove here for consistency: null move starting new game
    customFunctionOnMove();
  }

  if ((firstStart) && (autostartAutoplay)) { SetAutoPlay(true); }

  customFunctionOnPgnGameLoad();

  initialVariation = 0;
  firstStart = false;
}

function myAlertFEN(FenString, text) {
  myAlert("error: invalid FEN in game " + (currentGame+1) + ": " + text + "\n" + FenString, true);
}

function InitFEN(startingFEN) {
  if (typeof(startingFEN) != "string") { FenString = FenStringStart; }
  else { FenString = startingFEN.replace(/\\/g, "/").replace(/[^a-zA-Z0-9\s\/-]/g, " ").replace(/(^\s*|\s*$)/g, "").replace(/\s+/g, " "); }

  var ii, jj;
  for (ii = 0; ii < 8; ++ii) {
    for (jj = 0; jj < 8; ++jj) {
      Board[ii][jj] = 0;
    }
  }

  var color;
  StartPly  = 0;
  MoveCount = StartPly;
  MoveColor = StartPly % 2;
  StartMove = 0;

  var newEnPassant = false;
  var newEnPassantCol;
  CastlingLong = [0, 0];
  CastlingShort = [7, 7];
  InitialHalfMoveClock = 0;

  HistVar[StartPly] = 0;
  HistNull[StartPly] = 0;

  if (FenString == FenStringStart) {
    for (color = 0; color < 2; color++) {
      //                         K  Q  N     B     R     p
      PieceType[color]        = [1, 2, 5, 5, 4, 4, 3, 3, 6, 6, 6, 6, 6, 6, 6, 6];
      PieceCol[color]         = [4, 3, 1, 6, 2, 5, 0, 7, 0, 1, 2, 3, 4, 5, 6, 7];
      PieceMoveCounter[color] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
      PieceRow[color] = color ? [7, 7, 7, 7, 7, 7, 7, 7, 6, 6, 6, 6, 6, 6, 6, 6]:
                                [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1];
      for (ii = 0; ii < 16; ii++) {
        var col = PieceCol[color][ii];
        var row = PieceRow[color][ii];
        Board[col][row] = (1-2*color)*PieceType[color][ii];
      }
    }
  } else {
    var cc, kk, ll, nn, mm;
    for (ii = 0; ii < 2; ii++) {
      for (jj = 0; jj < 16; jj++) {
        PieceType[ii][jj] = -1;
        PieceCol[ii][jj] = 0;
        PieceRow[ii][jj] = 0;
        PieceMoveCounter[ii][jj] = 0;
      }
    }

    ii = 0; jj = 7; ll = 0; nn = 1; mm = 1; cc = FenString.charAt(ll++);
    while (cc != " ") {
      if (cc == "/") {
        if (ii != 8) {
          myAlertFEN(FenString, "char " + ll);
          InitFEN();
          return;
        }
        ii = 0;
        jj--;
      }
      if (ii == 8) {
        myAlertFEN(FenString, "char " + ll);
        InitFEN();
        return;
      }
      if (!isNaN(cc)) {
        ii += parseInt(cc,10);
        if ((ii < 0) || (ii > 8)) {
          myAlertFEN(FenString, "char " + ll);
          InitFEN();
          return;
        }
      }
      if (cc.charCodeAt(0) == FenPieceName.toUpperCase().charCodeAt(0)) {
        if (PieceType[0][0] != -1) {
          myAlertFEN(FenString, "char " + ll);
          InitFEN();
          return;
        }
        PieceType[0][0] = 1;
        PieceCol[0][0] = ii;
        PieceRow[0][0] = jj;
        ii++;
      }
      if (cc.charCodeAt(0) == FenPieceName.toLowerCase().charCodeAt(0)) {
        if (PieceType[1][0] != -1) {
          myAlertFEN(FenString, "char " + ll);
          InitFEN();
          return;
        }
        PieceType[1][0] = 1;
        PieceCol[1][0] = ii;
        PieceRow[1][0] = jj;
        ii++;
      }
      for (kk = 1; kk < 6; kk++) {
        if (cc.charCodeAt(0) == FenPieceName.toUpperCase().charCodeAt(kk)) {
          if (nn == 16) {
            myAlertFEN(FenString, "char " + ll);
            InitFEN();
            return;
          }
          PieceType[0][nn] = kk+1;
          PieceCol[0][nn] = ii;
          PieceRow[0][nn] = jj;
          nn++;
          ii++;
        }
        if (cc.charCodeAt(0) == FenPieceName.toLowerCase().charCodeAt(kk)) {
          if (mm==16) {
            myAlertFEN(FenString, "char " + ll);
            InitFEN();
            return;
          }
          PieceType[1][mm] = kk+1;
          PieceCol[1][mm] = ii;
          PieceRow[1][mm] = jj;
          mm++;
          ii++;
        }
      }
      cc = ll < FenString.length ? FenString.charAt(ll++) : " ";
    }
    if ((ii != 8) || (jj !== 0)) {
      myAlertFEN(FenString, "char " + ll);
      InitFEN();
      return;
    }
    if ((PieceType[0][0] == -1) || (PieceType[1][0] == -1)) {
      myAlertFEN(FenString, "missing King");
      InitFEN();
      return;
    }
    if (ll == FenString.length) {
      FenString += "w " + assumedCastleRights() + " - 0 1";
    }
    cc = FenString.charAt(ll++);
    if ((cc == "w") || (cc == "b")) {
      if (cc == "b") {
        StartMove = 1;
        StartPly += 1;
        MoveColor = 1;
      }
    } else {
      myAlertFEN(FenString, "invalid active color");
    }

    // set board
    for (color = 0; color < 2; ++color) {
      for (ii = 0; ii < 16; ii++) {
        if (PieceType[color][ii] != -1) {
          col = PieceCol[color][ii];
          row = PieceRow[color][ii];
          Board[col][row] = (1-2*color)*(PieceType[color][ii]);
        }
      }
    }

    ll++;
    if (ll >= FenString.length) {
      myAlertFEN(FenString, "missing castling availability");
      FenString += " " + assumedCastleRights() + " - 0 1";
      ll++;
    }
    CastlingLong = [-1, -1];
    CastlingShort = [-1, -1];
    cc = FenString.charAt(ll++);
    while (cc!=" ") {
      if (cc.charCodeAt(0) == FenPieceName.toUpperCase().charCodeAt(0)) {
        for (CastlingShort[0] = 7; CastlingShort[0] > PieceCol[0][0]; CastlingShort[0]--) {
          if (Board[CastlingShort[0]][0] == 3) { break; }
        }
        if (CastlingShort[0] <= PieceCol[0][0]) {
          myAlertFEN(FenString, "missing castling Rook " + cc);
          CastlingShort[0] = -1;
        }
      }
      if (cc.charCodeAt(0) == FenPieceName.toUpperCase().charCodeAt(1)) {
        for (CastlingLong[0] = 0; CastlingLong[0] < PieceCol[0][0]; CastlingLong[0]++) {
          if (Board[CastlingLong[0]][0] == 3) { break; }
        }
        if (CastlingLong[0] >= PieceCol[0][0]) {
          myAlertFEN(FenString, "missing castling Rook " + cc);
          CastlingLong[0] = -1;
        }
      }
      if (cc.charCodeAt(0) == FenPieceName.toLowerCase().charCodeAt(0)) {
        for (CastlingShort[1] = 7; CastlingShort[1] > PieceCol[1][0]; CastlingShort[1]--) {
          if (Board[CastlingShort[1]][7] == -3) { break; }
        }
        if (CastlingShort[1] <= PieceCol[1][0]) {
          myAlertFEN(FenString, "missing castling Rook " + cc);
          CastlingShort[1] = -1;
        }
      }
      if (cc.charCodeAt(0) == FenPieceName.toLowerCase().charCodeAt(1)) {
        for (CastlingLong[1] = 0; CastlingLong[1] < PieceCol[1][0]; CastlingLong[1]++) {
          if (Board[CastlingLong[1]][7] == -3) { break; }
        }
        if (CastlingLong[1] >= PieceCol[1][0]) {
          myAlertFEN(FenString, "missing castling Rook " + cc);
          CastlingLong[1] = -1;
        }
      }
      castlingRookCol = columnsLetters.toUpperCase().indexOf(cc);
      if (castlingRookCol >= 0) { color = 0; }
      else {
        castlingRookCol = columnsLetters.toLowerCase().indexOf(cc);
        if (castlingRookCol >= 0) { color = 1; }
      }
      if (castlingRookCol >= 0) {
        if (Board[castlingRookCol][color*7] == (1-2*color) * 3) {
          if (castlingRookCol > PieceCol[color][0]) { CastlingShort[color] = castlingRookCol; }
          if (castlingRookCol < PieceCol[color][0]) { CastlingLong[color] = castlingRookCol; }
        } else {
          myAlertFEN(FenString, "missing castling Rook " + cc);
        }
      }
      cc = ll<FenString.length ? FenString.charAt(ll++) : " ";
    }

    if (ll >= FenString.length) {
      myAlertFEN(FenString, "missing en passant square");
      FenString += " - 0 1";
      ll++;
    }
    cc = FenString.charAt(ll++);
    while (cc != " ") {
      if ((cc.charCodeAt(0)-97 >= 0) && (cc.charCodeAt(0)-97 <= 7)) {
        newEnPassant = true;
        newEnPassantCol = cc.charCodeAt(0)-97;
      }
      cc = ll<FenString.length ? FenString.charAt(ll++) : " ";
    }
    if (ll >= FenString.length) {
      myAlertFEN(FenString, "missing halfmove clock");
      FenString += " 0 1";
      ll++;
    }
    InitialHalfMoveClock = 0;
    cc = FenString.charAt(ll++);
    while (cc != " ") {
      if (isNaN(cc)) {
        myAlertFEN(FenString, "invalid halfmove clock");
        break;
      }
      InitialHalfMoveClock=InitialHalfMoveClock*10+parseInt(cc,10);
      cc = ll<FenString.length ? FenString.charAt(ll++) : " ";
    }
    if (ll >= FenString.length) {
      myAlertFEN(FenString, "missing fullmove number");
      FenString += " 1";
      ll++;
    }

    InitialFullMoveNumber = 0;
    cc = FenString.charAt(ll++);
    while (cc != " ") {
      if (isNaN(cc)) {
        myAlertFEN(FenString, "invalid fullmove number");
        InitialFullMoveNumber = 1;
        break;
      }
      InitialFullMoveNumber=InitialFullMoveNumber*10+parseInt(cc,10);
      cc = ll<FenString.length ? FenString.charAt(ll++) : " ";
    }
    if (InitialFullMoveNumber === 0) {
      myAlertFEN(FenString, "invalid fullmove 0 set to 1");
      InitialFullMoveNumber = 1;
    }
    StartPly += 2*(InitialFullMoveNumber-1);

    HistEnPassant[StartPly] = newEnPassant;
    HistEnPassantCol[StartPly] = newEnPassantCol;
    HistNull[StartPly] = 0;
    HistVar[StartPly] = 0;
  }
}

// castling rights assuming Kings and Rooks starting positions as in normal chess
function assumedCastleRights() {
  var assumedRights = "";
  if ((PieceRow[0][0] === 0) && (PieceCol[0][0] === 4)) {
    for (ii = 0; ii < PieceType[0].length; ii++) {
      if ((PieceType[0][ii] === 3) && (PieceRow[0][ii] === 0) && (PieceCol[0][ii] === 7)) {
        assumedRights += FenPieceName.charAt(0).toUpperCase();
      }
      if ((PieceType[0][ii] === 3) && (PieceRow[0][ii] === 0) && (PieceCol[0][ii] === 0)) {
        assumedRights += FenPieceName.charAt(1).toUpperCase();
      }
    }
  }
  if ((PieceRow[1][0] === 7) && (PieceCol[1][0] === 4)) {
    for (ii = 0; ii < PieceType[1].length; ii++) {
      if ((PieceType[1][ii] === 3) && (PieceRow[1][ii] === 7) && (PieceCol[1][ii] === 7)) {
        assumedRights += FenPieceName.charAt(0).toLowerCase();
      }
      if ((PieceType[1][ii] === 3) && (PieceRow[1][ii] === 7) && (PieceCol[1][ii] === 0)) {
        assumedRights += FenPieceName.charAt(1).toLowerCase();
      }
    }
  }
  return assumedRights ? assumedRights : "-";
}


function SetImageType(extension) {
  imageType = extension;
}

function InitImages() {
  if (ImagePathOld === ImagePath) { return; }

  if ((ImagePath.length > 0) && (ImagePath[ImagePath.length-1] != '/')) {
    ImagePath += '/';
  }

  ClearImg = new Image();
  ClearImg.src = ImagePath+'clear.'+imageType;

  ColorName = new Array ("w", "b");
  PiecePrefix = new Array ("k", "q", "r", "b", "n", "p");
  for (color = 0; color < 2; ++color) {
    for (piece = 1; piece < 7; piece++) {
      PiecePicture[color][piece] = new Image();
      PiecePicture[color][piece].src = ImagePath + ColorName[color] + PiecePrefix[piece-1] + '.' + imageType;
    }
  }
  ImagePathOld = ImagePath;
}


function IsCheck(col, row, color) {
  var ii, jj;
  var sign = 2*color-1; // white or black

  // other king giving check?
  if ((Math.abs(PieceCol[1-color][0]-col) <= 1) &&
      (Math.abs(PieceRow[1-color][0]-row) <= 1)) { return true; }

  // knight?
  for (ii = -2; ii <= 2; ii += 4) {
    for (jj = -1; jj <= 1; jj += 2) {
      if (SquareOnBoard(col+ii, row+jj)) {
        if (Board[col+ii][row+jj] == sign*5) { return true; }
      }
      if (SquareOnBoard(col+jj, row+ii)) {
        if (Board[col+jj][row+ii] == sign*5) { return true; }
      }
    }
  }

  // pawn?
  for (ii = -1; ii <= 1; ii += 2) {
    if (SquareOnBoard(col+ii, row-sign)) {
      if (Board[col+ii][row-sign] == sign*6) { return true; }
    }
  }

  // queens, rooks, bishops?
  for (ii = -1; ii <= 1; ++ii) {
    for (jj = -1; jj <= 1; ++jj) {
      if ((ii !== 0) || (jj !== 0)) {
        var checkCol  = col+ii;
        var checkRow  = row+jj;
        var thisPiece = 0;

        while (SquareOnBoard(checkCol, checkRow) && (thisPiece === 0)) {
          thisPiece = Board[checkCol][checkRow];
          if (thisPiece === 0) {
            checkCol += ii;
            checkRow += jj;
          } else {
            if (thisPiece  == sign*2) { return true; }
            if ((thisPiece == sign*3) && ((ii === 0) || (jj === 0))) { return true; }
            if ((thisPiece == sign*4) && ((ii !== 0) && (jj !== 0))) { return true; }
          }
        }
      }
    }
  }
  return false;
}


function fixRegExp(exp) {
  return exp.replace(/([\[\]\(\)\{\}\.\*\+\^\$\|\?\\])/g, "\\$1");
}

function LoadGameHeaders() {
  var ii;
  var parse;

  gameEvent.length = gameSite.length = gameRound.length = gameDate.length = 0;
  gameWhite.length = gameBlack.length = gameResult.length = 0;
  gameSetUp.length = gameFEN.length = 0;
  gameInitialWhiteClock.length = gameInitialBlackClock.length = 0;
  gameVariant.length = 0;

  pgnHeaderTagRegExpGlobal.lastIndex = 0; // resets global regular expression
  for (ii = 0; ii < numberOfGames; ++ii) {
    var ss = pgnHeader[ii];
    gameEvent[ii] = gameSite[ii] = gameRound[ii] = gameDate[ii] = "";
    gameWhite[ii] = gameBlack[ii] = gameResult[ii] = "";
    gameInitialWhiteClock[ii] = gameInitialBlackClock[ii] = "";
    gameVariant[ii] = "";
    while (parse = pgnHeaderTagRegExpGlobal.exec(ss)) {
      switch (parse[1]) {
        case 'Event': gameEvent[ii] = parse[2]; break;
        case 'Site': gameSite[ii] = parse[2]; break;
        case 'Round': gameRound[ii] = parse[2]; break;
        case 'Date': gameDate[ii] = parse[2]; break;
        case 'White': gameWhite[ii] = parse[2]; break;
        case 'Black': gameBlack[ii] = parse[2]; break;
        case 'Result': gameResult[ii] = parse[2]; break;
        case 'SetUp': gameSetUp[ii] = parse[2]; break;
        case 'FEN': gameFEN[ii] = parse[2]; break;
        case 'WhiteClock': gameInitialWhiteClock[ii] = parse[2]; break;
        case 'BlackClock': gameInitialBlackClock[ii] = parse[2]; break;
        case 'Variant': gameVariant[ii] = parse[2]; break;
        default: break;
      }
    }
  }
  if ((LiveBroadcastDemo) && (numberOfGames > 0)) {
    for (ii = 0; ii < numberOfGames; ++ii) {
      if ((gameDemoLength[ii] === undefined) || (gameDemoLength[ii] === 0)) {
         InitFEN(gameFEN[ii]);
         ParsePGNGameString(pgnGame[ii]);
         gameDemoLength[ii] = PlyNumber;
      }
      if (gameDemoMaxPly[ii] === undefined) { gameDemoMaxPly[ii] = 0; }
      if (gameDemoMaxPly[ii] <= gameDemoLength[ii]) { gameResult[ii] = '*'; }
    }
  }
  return;
}


function MoveBackward(diff, scanOnly) {

  // CurrentPly counts from 1, starting position 0
  var goFromPly  = CurrentPly - 1;
  var goToPly    = goFromPly  - diff;
  if (goToPly < StartPly) { goToPly = StartPly-1; }

  // reconstruct old position
  for (var thisPly = goFromPly; thisPly > goToPly; --thisPly) {
    CurrentPly--;
    MoveColor = 1-MoveColor;

    CurrentVar = HistVar[thisPly];

    if (HistNull[thisPly]) { continue; }

    // moved piece back to original square
    var chgPiece = HistPieceId[0][thisPly];
    Board[PieceCol[MoveColor][chgPiece]][PieceRow[MoveColor][chgPiece]] = 0;

    Board[HistCol[0][thisPly]][HistRow[0][thisPly]] = HistType[0][thisPly] * (1-2*MoveColor);
    PieceType[MoveColor][chgPiece] = HistType[0][thisPly];
    PieceCol[MoveColor][chgPiece] = HistCol[0][thisPly];
    PieceRow[MoveColor][chgPiece] = HistRow[0][thisPly];
    PieceMoveCounter[MoveColor][chgPiece]--;

    // castling: rook back to original square
    chgPiece = HistPieceId[1][thisPly];
    if ((chgPiece >= 0) && (chgPiece < 16)) {
      Board[PieceCol[MoveColor][chgPiece]][PieceRow[MoveColor][chgPiece]] = 0;
      Board[HistCol[1][thisPly]][HistRow[1][thisPly]] = HistType[1][thisPly] * (1-2*MoveColor);
      PieceType[MoveColor][chgPiece] = HistType[1][thisPly];
      PieceCol[MoveColor][chgPiece] = HistCol[1][thisPly];
      PieceRow[MoveColor][chgPiece] = HistRow[1][thisPly];
      PieceMoveCounter[MoveColor][chgPiece]--;
    }

    // capture: captured piece back to original square
    chgPiece -= 16;
    if ((chgPiece >= 0) && (chgPiece < 16)) {
      Board[PieceCol[1-MoveColor][chgPiece]][PieceRow[1-MoveColor][chgPiece]] = 0;
      Board[HistCol[1][thisPly]][HistRow[1][thisPly]] = HistType[1][thisPly] * (2*MoveColor-1);
      PieceType[1-MoveColor][chgPiece] = HistType[1][thisPly];
      PieceCol[1-MoveColor][chgPiece] = HistCol[1][thisPly];
      PieceRow[1-MoveColor][chgPiece] = HistRow[1][thisPly];
      PieceMoveCounter[1-MoveColor][chgPiece]--;
    }
  }

  if (scanOnly) { return; }

  synchMoves();

  // old position reconstructed: refresh board
  RefreshBoard();
  HighlightLastMove();

  autoScrollToCurrentMoveIfEnabled();

  // autoplay: restart timeout
  if (AutoPlayInterval) { clearTimeout(AutoPlayInterval); AutoPlayInterval = null; }
  if (isAutoPlayOn) {
    if (goToPly >= StartPlyVar[CurrentVar]) { AutoPlayInterval=setTimeout("MoveBackward(1)", Delay); }
    else { SetAutoPlay(false); }
  }

  customFunctionOnMove();
}

function MoveForward(diff, targetVar, scanOnly) {

  var oldVar = -1;

  if (typeof(targetVar) == "undefined") { targetVar = CurrentVar; }

  // CurrentPly counts from 1, starting position 0
  goToPly = CurrentPly + parseInt(diff,10);

  if (goToPly > StartPlyVar[targetVar] + PlyNumberVar[targetVar]) {
    goToPly = StartPlyVar[targetVar] + PlyNumberVar[targetVar];
  }

  // reach to selected move checking legality
  for (var thisPly = CurrentPly; thisPly < goToPly; ++thisPly) {

    if (targetVar !== CurrentVar) {
      for (var ii = 0; ii < PredecessorsVars[targetVar].length; ii++) {
        if (PredecessorsVars[targetVar][ii] === CurrentVar) { break; }
      }
      if (ii === PredecessorsVars[targetVar].length) {
        myAlert("error: unknown path to reach variation " + targetVar + " from " + CurrentVar + " in game " + (currentGame+1), true);
        return;
      } else {
        nextVarStartPly = StartPlyVar[PredecessorsVars[targetVar][ii + 1]];
        for (ii = ii+1; ii < PredecessorsVars[targetVar].length - 1; ii++) {
          if (StartPlyVar[PredecessorsVars[targetVar][ii+1]] !== StartPlyVar[PredecessorsVars[targetVar][ii]] ) { break; }
        }
        nextVar = PredecessorsVars[targetVar][ii];
      }
    } else { nextVar = nextVarStartPly = -1; }

    if (thisPly === nextVarStartPly) {
      oldVar = CurrentVar;
      CurrentVar = nextVar;
    }

    if (typeof(move = MovesVar[CurrentVar][thisPly]) == "undefined") { break; }

    if (ParseLastMoveError = !ParseMove(move, thisPly)) {
      text = (Math.floor(thisPly / 2) + 1) + ((thisPly % 2) === 0 ? '. ' : '... ');
      myAlert('error: invalid ply ' + text + move + ' in game ' + (currentGame+1) + ' variation ' + CurrentVar, true);
      if (thisPly === nextVarStartPly) { CurrentVar = oldVar; }
      break;
    }
    MoveColor = 1-MoveColor;

  }

  // new position: update ply count, then refresh board
  CurrentPly = thisPly;

  if (scanOnly) { return; }

  synchMoves();

  RefreshBoard();
  HighlightLastMove();

  autoScrollToCurrentMoveIfEnabled();

  // autoplay: restart timeout
  if (AutoPlayInterval) { clearTimeout(AutoPlayInterval); AutoPlayInterval = null; }
  if (ParseLastMoveError) { SetAutoPlay(false); }
  else if (thisPly == goToPly) {
    if (isAutoPlayOn) {
      if (goToPly < StartPlyVar[CurrentVar] + PlyNumberVar[CurrentVar]) {
        AutoPlayInterval=setTimeout("MoveForward(1)", Delay);
      } else {
        if (autoplayNextGame && (CurrentVar === 0)) { AutoPlayInterval=setTimeout("AutoplayNextGame()", Delay); }
        else { SetAutoPlay(false); }
      }
    }
  }

  customFunctionOnMove();
}

lastSynchCurrentVar = -1;
function synchMoves() {
  if (CurrentVar === lastSynchCurrentVar) { return; }
  Moves = new Array();
  MoveComments = new Array();
  for (var ii = 0; ii < PredecessorsVars[CurrentVar].length; ii++) {
    start = StartPlyVar[PredecessorsVars[CurrentVar][ii]];
    if (ii < PredecessorsVars[CurrentVar].length - 1) {
      end = StartPlyVar[PredecessorsVars[CurrentVar][ii+1]];
    } else {
      end = StartPlyVar[PredecessorsVars[CurrentVar][ii]] + PlyNumberVar[PredecessorsVars[CurrentVar][ii]];
    }
    for (var jj = start; jj < end; jj++) {
      Moves[jj] = MovesVar[PredecessorsVars[CurrentVar][ii]][jj];
      if (theComment = MoveCommentsVar[PredecessorsVars[CurrentVar][ii]][jj]) {
        MoveComments[jj] = theComment;
      } else {
        MoveComments[jj] = "";
      }
    }
  }
  if (theComment = MoveCommentsVar[PredecessorsVars[CurrentVar][ii-1]][jj]) {
    MoveComments[jj] = theComment;
  } else {
    MoveComments[jj] = "";
  }
  PlyNumber = StartPlyVar[CurrentVar] + PlyNumberVar[CurrentVar] - StartPly;
  lastSynchCurrentVar = CurrentVar;
}


function AutoplayNextGame() {
  if (fatalErrorNumSinceReset === 0) {
    if (numberOfGames > 0) {
      Init((currentGame + 1) % numberOfGames);
      if ((numberOfGames > 1) || (PlyNumber > 0)) {
        SetAutoPlay(true);
        return;
      }
    }
  }
  SetAutoPlay(false);
}

function MoveToNextComment(varOnly) {
  for (ii=CurrentPly+1; ii<=StartPlyVar[CurrentVar] + PlyNumberVar[CurrentVar]; ii++) {
    if (MoveComments[ii].match(pgn4webVariationRegExp) || (!varOnly && strippedMoveComment(ii))) { GoToMove(ii); break; }
  }
}

function MoveToPrevComment(varOnly) {
  for (ii=(CurrentPly-1); ii>=StartPly; ii--) {
    if ((ii > 0 || CurrentVar > 0) && ii === StartPlyVar[HistVar[ii+1]]) { GoToMove(ii+1, HistVar[ii]); break; }
    if (MoveComments[ii].match(pgn4webVariationRegExp) || (!varOnly && strippedMoveComment(ii))) { GoToMove(ii); break; }
  }
}


function OpenGame(gameId) {
  ParsePGNGameString(pgnGame[gameId]);
  currentGame = gameId;
  ParseLastMoveError = false;

  if (LiveBroadcastDemo) {
    if (gameDemoMaxPly[gameId] <= PlyNumber) { PlyNumber = PlyNumberVar[0] = gameDemoMaxPly[gameId]; }
  }

  PrintHTML();
}

var CurrentVar = -1;
var lastVarWithNoMoves;
var numberOfVars;
var MovesVar;
var MoveCommentsVar;
var GameHasComments;
var StartPlyVar;
var PlyNumberVar;
var CurrentVarStack;
var PlyNumberStack;
var PredecessorsVars;

function initVar () {
  MovesVar = new Array();
  MoveCommentsVar = new Array();
  GameHasComments = false;
  GameHasVariations = false;
  StartPlyVar = new Array();
  PlyNumberVar = new Array();
  CurrentVar = -1;
  lastVarWithNoMoves = [false];
  numberOfVars = 0;
  CurrentVarStack = new Array();
  PlyNumber = 1;
  PlyNumberStack = new Array();
  PredecessorsVars = new Array();
  startVar(false);
}

function startVar(isContinuation) {
  if (CurrentVar >= 0) {
    CurrentVarStack.push(CurrentVar);
    PlyNumberStack.push(PlyNumber);
  }
  CurrentVar = numberOfVars++;
  PredecessorsVars[CurrentVar] = CurrentVarStack.slice(0);
  PredecessorsVars[CurrentVar].push(CurrentVar);
  MovesVar[CurrentVar] = new Array();
  MoveCommentsVar[CurrentVar] = new Array();
  if (!isContinuation) {
    if (lastVarWithNoMoves[lastVarWithNoMoves.length - 1]) {
      myAlert("warning: malformed PGN data in game " + (currentGame+1) + ": variant " + CurrentVar + " starting before parent", true);
    } else {
      PlyNumber -= 1;
    }
  }
  lastVarWithNoMoves.push(true);
  MoveCommentsVar[CurrentVar][StartPly + PlyNumber] = "";
  StartPlyVar[CurrentVar] = StartPly + PlyNumber;
}

function closeVar() {
  if (StartPly + PlyNumber ===  StartPlyVar[CurrentVar]) {
    myAlert("warning: empty variation " + CurrentVar + " in game " + (currentGame+1), false);
  } else {
    GameHasVariations = true;
  }
  lastVarWithNoMoves.pop();
  PlyNumberVar[CurrentVar] = StartPly + PlyNumber - StartPlyVar[CurrentVar];
  for (var ii=StartPlyVar[CurrentVar]; ii<=StartPlyVar[CurrentVar]+PlyNumberVar[CurrentVar]; ii++) {
    if (MoveCommentsVar[CurrentVar][ii]) {
      MoveCommentsVar[CurrentVar][ii] = MoveCommentsVar[CurrentVar][ii].replace(/\s+/g, ' ');
      MoveCommentsVar[CurrentVar][ii] = translateNAGs(MoveCommentsVar[CurrentVar][ii]);
      MoveCommentsVar[CurrentVar][ii] = MoveCommentsVar[CurrentVar][ii].replace(/\s+$/g, '');
    } else {
      MoveCommentsVar[CurrentVar][ii] = '';
    }
  }
  if (CurrentVarStack.length) {
    CurrentVar = CurrentVarStack.pop();
    PlyNumber = PlyNumberStack.pop();
  } else {
    myAlert("error: closeVar error" + " in game " + (currentGame+1), true);
  }
}

function childrenVars(thisPly, thisVar) {
  if (typeof(thisVar) == "undefined") { thisVar = CurrentVar; }
  if (typeof(thisPly) == "undefined") { thisPly = CurrentPly; }
  children = new Array();
  for (var ii = thisVar; ii < numberOfVars; ii++) {
    if ((ii === thisVar && StartPlyVar[ii] + PlyNumberVar[ii] > thisPly) || (realParentVar(ii) === thisVar && StartPlyVar[ii] === thisPly && PlyNumberVar[ii] > 0)) {
      children.push(ii);
    }
  }
  return children;
}

function realParentVar(childVar) {
  for (var ii = PredecessorsVars[childVar].length - 1; ii > 0; ii--) {
    if (StartPlyVar[PredecessorsVars[childVar][ii]] !== StartPlyVar[PredecessorsVars[childVar][ii-1]]) {
      return PredecessorsVars[childVar][ii-1];
    }
  }
  return PredecessorsVars[childVar][ii];
}

function goToNextVariationSibling() {
  if (CurrentPly === StartPly) { return false; }
  siblingVarList = childrenVars(CurrentPly - 1, HistVar[CurrentPly - 1]);
  if (siblingVarList.length < 2) { return false; }
  for (var ii = 0; ii < siblingVarList.length; ii++) {
    if (siblingVarList[ii] === CurrentVar) { break; }
  }
  if (siblingVarList[ii] !== CurrentVar) { return false; }
  GoToMove(CurrentPly, siblingVarList[(ii + 1) % siblingVarList.length]);
  return true;
}

function goToFirstChild() {
  childrenVarList = childrenVars(CurrentPly, CurrentVar);
  if (childrenVarList.length < 1) { return false; }
  if (childrenVarList[0] === CurrentVar) {
    if (childrenVarList.length < 2) { return false; }
    GoToMove(CurrentPly + 1, childrenVarList[1]);
  } else {
    GoToMove(CurrentPly + 1, childrenVarList[0]);
  }
  return true;
}

function ParsePGNGameString(gameString) {

  var ssRep, ss = gameString, ssComm;
  ss = ss.replace(pgn4webVariationRegExpGlobal, "[%_pgn4web_variation_ $1]");
  // empty variations to comments
  while ((ssRep = ss.replace(/\((([\?!+#\s]|\$\d+|{[^}]*})*)\)/g, ' $1 ')) !== ss) { ss = ssRep; }
  ss = ss.replace(/^\s/, '');
  ss = ss.replace(/\s$/, '');

  initVar ();

  PlyNumber = 0;

  for (start=0; start<ss.length; start++) {

    switch (ss.charAt(start)) {

      case ' ':
      case '\b':
      case '\f':
      case '\n':
      case '\r':
      case '\t':
        break;

      case '$':
        commentStart = start;
        commentEnd = commentStart + 1;
        while ('0123456789'.indexOf(ss.charAt(commentEnd)) >= 0) {
          commentEnd++;
          if (commentEnd == ss.length) { break; }
        }
        if (MoveCommentsVar[CurrentVar][StartPly+PlyNumber]) { MoveCommentsVar[CurrentVar][StartPly+PlyNumber] += ' '; }
        MoveCommentsVar[CurrentVar][StartPly+PlyNumber] += translateNAGs(ss.substring(commentStart, commentEnd).replace(/(^\s*|\s*$)/, ''));
        start = commentEnd - 1;
        break;

      case '!':
      case '?':
        commentStart = start;
        commentEnd = commentStart + 1;
        while ('!?'.indexOf(ss.charAt(commentEnd)) >= 0) {
          commentEnd++;
          if (commentEnd == ss.length) { break; }
        }
        if (MoveCommentsVar[CurrentVar][StartPly+PlyNumber]) { MoveCommentsVar[CurrentVar][StartPly+PlyNumber] += ' '; }
        MoveCommentsVar[CurrentVar][StartPly+PlyNumber] += ss.substring(commentStart, commentEnd);
        start = commentEnd - 1;
        break;

      case '{':
        commentStart = start+1;
        commentEnd = ss.indexOf('}',start+1);
        if (commentEnd > 0) {
          if (MoveCommentsVar[CurrentVar][StartPly+PlyNumber]) { MoveCommentsVar[CurrentVar][StartPly+PlyNumber] += ' '; }
          ssComm = translateNAGs(ss.substring(commentStart, commentEnd).replace(/(^\s*|\s*$)/, ''));
          MoveCommentsVar[CurrentVar][StartPly+PlyNumber] += ssComm;
          GameHasComments = GameHasComments || ssComm.replace(/\[%[^\]]*\]\s*/g,'').replace(basicNAGs, '').replace(/^\s+$/,'') !== '';
          start = commentEnd;
        } else {
          myAlert('error: missing end comment char } while parsing game ' + (currentGame+1), true);
          return;
        }
        break;

      case '%':
        // % must be first char of the line
        if ((start > 0) && (ss.charAt(start-1) != '\n')) { break; }
        commentStart = start+1;
        commentEnd = ss.indexOf('\n',start+1);
        if (commentEnd < 0) { commentEnd = ss.length; }
        start = commentEnd;
        break;

      case ';':
        commentStart = start+1;
        commentEnd = ss.indexOf('\n',start+1);
        if (commentEnd < 0) { commentEnd = ss.length; }
        if (MoveCommentsVar[CurrentVar][StartPly+PlyNumber]) { MoveCommentsVar[CurrentVar][StartPly+PlyNumber] += ' '; }
        ssComm = translateNAGs(ss.substring(commentStart, commentEnd).replace(/(^\s*|\s*$)/, ''));
        MoveCommentsVar[CurrentVar][StartPly+PlyNumber] += ssComm;
        GameHasComments = GameHasComments || ssComm.replace(/\[%[^\]]*\]\s*/g,'').replace(basicNAGs, '').replace(/^\s+$/,'') !== '';
        start = commentEnd;
        break;

      case '(':
        if (isContinuation = (ss.charAt(start+1) == '*')) { start += 1; }
        MoveCommentsVar[CurrentVar][StartPly+PlyNumber] += ' [%pgn4web_variation ' + numberOfVars + '] ';
        startVar(isContinuation);
        break;

      case ')':
        closeVar();
        break;

      case '&': // nullmove "<>" became "&lt;&gt;"
        if (ss.substr(start, 8) == "&lt;&gt;") {
          ss = ss.slice(0, start) + "     -- " + ss.slice(start + 8);
          start += 4;
          break;
        }
        // dont add "break;"

      default:

        searchThis = new Array('1-0', '0-1', '1/2-1/2', '*');
        for (ii=0; ii<searchThis.length; ii++) {
          if (ss.indexOf(searchThis[ii],start)==start) {
            if (CurrentVar === 0) {
               start += searchThis[ii].length;
               end = ss.length;
            } else {
               end = start + searchThis[ii].length;
            }
            if (MoveCommentsVar[CurrentVar][StartPly+PlyNumber]) { MoveCommentsVar[CurrentVar][StartPly+PlyNumber] += ' '; }
            MoveCommentsVar[CurrentVar][StartPly+PlyNumber] += ss.substring(start, end).replace(/^\s*\{(.*)\}\s*$/, '$1');
            start = end;
            break;
          }
        }
        if (start == ss.length) { break; }

        moveCount = Math.floor((StartPly+PlyNumber)/2)+1;
        searchThis = moveCount.toString()+'.';
        if (ss.indexOf(searchThis,start)==start) {
          start += searchThis.length;
          while ((ss.charAt(start) == '.') || (ss.charAt(start) == ' ') ||
                 (ss.charAt(start) == '\n') || (ss.charAt(start) == '\r'))
            { start++; }
        }

        if ((end = start + ss.substr(start).search(/[\s${;!?()]/)) < start) { end = ss.length; }
        move = ss.substring(start,end);
        MovesVar[CurrentVar][StartPly+PlyNumber] = CleanMove(move);
        lastVarWithNoMoves[lastVarWithNoMoves.length - 1] = false;
        if (ss.charAt(end) == ' ') { start = end; }
        else { start = end - 1; }
        if (!MovesVar[CurrentVar][StartPly+PlyNumber].match(/^[\s+#]*$/)) { // to cope with malsformed PGN data
          PlyNumber++;
          MoveCommentsVar[CurrentVar][StartPly+PlyNumber] = '';
        }
        break;
    }
  }

  if (CurrentVar !== 0) {
    myAlert("error: ParsePGNGameString ends with current var = " + CurrentVar, true);
    while (CurrentVar > 0) { closeVar(); }
  }

  StartPlyVar[0] = StartPly;
  PlyNumberVar[0] = PlyNumber;

  GameHasComments = GameHasComments || GameHasVariations;

  lastSynchCurrentVar = -1;
}


var NAG = new Array();
NAG[0] = '';
NAG[1] = '!';  // 'good move';
NAG[2] = '?';  // 'bad move';
NAG[3] = '!!'; // 'very good move';
NAG[4] = '??'; // 'very bad move';
NAG[5] = '!?'; // 'speculative move';
NAG[6] = '?!'; // 'questionable move';
NAG[7] = 'forced move'; // '[]';
NAG[8] = 'singular move'; // '[]';
NAG[9] = 'worst move'; // '??';
NAG[10] = 'drawish position'; // '=';
NAG[11] = 'equal chances, quiet position'; // '=';
NAG[12] = 'equal chances, active position'; // '=';
NAG[13] = 'unclear position'; // '~~';
NAG[14] = 'White has a slight advantage'; // NAG[15] = '+/=';
NAG[16] = 'White has a moderate advantage'; // NAG[17] = '+/-';
NAG[18] = 'White has a decisive advantage'; // NAG[19] = '+-';
NAG[20] = 'White has a crushing advantage'; // NAG[21] = '+-';
NAG[22] = 'White is in zugzwang'; // NAG[23] = '(.)';
NAG[24] = 'White has a slight space advantage'; // NAG[25] = '()';
NAG[26] = 'White has a moderate space advantage'; // NAG[27] = '()';
NAG[28] = 'White has a decisive space advantage'; // NAG[29] = '()';
NAG[30] = 'White has a slight time (development) advantage'; // NAG[31] = '@';
NAG[32] = 'White has a moderate time (development) advantage'; // NAG[33] = '@';
NAG[34] = 'White has a decisive time (development) advantage'; // NAG[35] = '@';
NAG[36] = 'White has the initiative'; // NAG[37] = '|^';
NAG[38] = 'White has a lasting initiative'; // NAG[39] = '|^';
NAG[40] = 'White has the attack'; // NAG[41] = '->';
NAG[42] = 'White has insufficient compensation for material deficit';
NAG[44] = 'White has sufficient compensation for material deficit'; // NAG[45] = '=/~';
NAG[46] = 'White has more than adequate compensation for material deficit'; // NAG[47] = '=/~';
NAG[48] = 'White has a slight center control advantage'; // NAG[49] = '[+]';
NAG[50] = 'White has a moderate center control advantage'; // NAG[51] = '[+]';
NAG[52] = 'White has a decisive center control advantage'; // NAG[53] = '[+]';
NAG[54] = 'White has a slight kingside control advantage'; // NAG[55] = '>>';
NAG[56] = 'White has a moderate kingside control advantage'; // NAG[57] = '>>';
NAG[58] = 'White has a decisive kingside control advantage'; // NAG[59] = '>>';
NAG[60] = 'White has a slight queenside control advantage'; // NAG[61] = '<<';
NAG[62] = 'White has a moderate queenside control advantage'; // NAG[63] = '<<';
NAG[64] = 'White has a decisive queenside control advantage'; // NAG[65] = '<<';
NAG[66] = 'White has a vulnerable first rank';
NAG[68] = 'White has a well protected first rank';
NAG[70] = 'White has a poorly protected king';
NAG[72] = 'White has a well protected king';
NAG[74] = 'White has a poorly placed king';
NAG[76] = 'White has a well placed king';
NAG[78] = 'White has a very weak pawn structure';
NAG[80] = 'White has a moderately weak pawn structure';
NAG[82] = 'White has a moderately strong pawn structure';
NAG[84] = 'White has a very strong pawn structure';
NAG[86] = 'White has poor knight placement';
NAG[88] = 'White has good knight placement';
NAG[90] = 'White has poor bishop placement';
NAG[92] = 'White has good bishop placement';
NAG[94] = 'White has poor rook placement';
NAG[96] = 'White has good rook placement';
NAG[98] = 'White has poor queen placement';
NAG[100] = 'White has good queen placement';
NAG[102] = 'White has poor piece coordination';
NAG[104] = 'White has good piece coordination';
NAG[106] = 'White has played the opening very poorly';
NAG[108] = 'White has played the opening poorly';
NAG[110] = 'White has played the opening well';
NAG[112] = 'White has played the opening very well';
NAG[114] = 'White has played the middlegame very poorly';
NAG[116] = 'White has played the middlegame poorly';
NAG[118] = 'White has played the middlegame well';
NAG[120] = 'White has played the middlegame very well';
NAG[122] = 'White has played the ending very poorly';
NAG[124] = 'White has played the ending poorly';
NAG[126] = 'White has played the ending well';
NAG[128] = 'White has played the ending very well';
NAG[130] = 'White has slight counterplay'; // NAG[131] = '<=>';
NAG[132] = 'White has moderate counterplay'; // NAG[133] = '<=>';
NAG[134] = 'White has decisive counterplay'; // NAG[135] = '<=>';
NAG[136] = 'White has moderate time control pressure'; // NAG[137] = '(+)';
NAG[138] = 'White has severe time control pressure'; // NAG[139] = '(+)';

for (ii = 14; ii < 139; ii += 2) { NAG[ii+1] = NAG[ii].replace("White", "Black"); }

function translateNAGs(comment) {
  if (matches = comment.match(/\$+[0-9]+/g)) {
    for (var ii = 0; ii < matches.length; ii++) {
      nag = matches[ii].substr(1);
      if (NAG[nag] !== undefined) {
        comment = comment.replace(new RegExp("\\$+" + nag + "(?!\\d)"), NAG[nag]);
      }
    }
  }
  return comment;
}

function ParseMove(move, plyCount) {
  var ii, ll;
  var rem;
  var toRowMarker = -1;

  castleRook = -1;
  mvIsCastling =  0;
  mvIsPromotion =  0;
  mvCapture =  0;
  mvFromCol = -1;
  mvFromRow = -1;
  mvToCol = -1;
  mvToRow = -1;
  mvPiece = -1;
  mvPieceId = -1;
  mvPieceOnTo = -1;
  mvCaptured = -1;
  mvCapturedId = -1;
  mvIsNull = 0;

  if (typeof(move) == "undefined") { return false; }

  if (move.indexOf('--') === 0) {
    mvIsNull = 1;
    CheckLegality('--', plyCount);
    return true;
  }

  // get destination column/row remembering what's left e.g. Rdxc3 exf8=Q#
  for (ii = move.length-1; ii > 0; ii--) {
    if (!isNaN(move.charAt(ii))) {
      mvToCol = move.charCodeAt(ii-1) - 97;
      mvToRow = move.charAt(ii) - 1;
      rem = move.substring(0, ii-1);
      toRowMarker = ii;
      break;
    }
  }

  // final square did not make sense: maybe a castle?
  if ((mvToCol < 0) || (mvToCol > 7) || (mvToRow < 0) || (mvToRow > 7)) {
    // long castling first: looking for o-o will get o-o-o too
    if (move.indexOf('O-O-O') === 0) {
      mvIsCastling = 1;
      mvPiece = 1;
      mvPieceId = 0;
      mvPieceOnTo = 1;
      mvFromCol = 4;
      mvToCol = 2;
      mvFromRow = 7*MoveColor;
      mvToRow = 7*MoveColor;
      return CheckLegality('O-O-O', plyCount);
    } else if (move.indexOf('O-O') === 0) {
      mvIsCastling = 1;
      mvPiece = 1;
      mvPieceId = 0;
      mvPieceOnTo = 1;
      mvFromCol = 4;
      mvToCol = 6;
      mvFromRow = 7*MoveColor;
      mvToRow = 7*MoveColor;
      return CheckLegality('O-O', plyCount);
    } else { return false; }
  }

  rem = rem.replace(/-/g, '');
  // get piece and origin square: mark captures ('x' is there)
  ll = rem.length;
  if (ll > 4) { return false; }
  mvPiece = -1; // make sure mvPiece is properly assigned later
  if (ll === 0) { mvPiece = 6; }
  else {
    for (ii = 1; ii < 6; ++ii) { if (rem.charAt(0) == PieceCode[ii-1]) { mvPiece = ii; } }
    if (mvPiece == -1) { if (columnsLetters.toLowerCase().indexOf(rem.charAt(0)) >= 0) { mvPiece = 6; } }
    if (mvPiece == -1) { return false; }
    if (rem.charAt(ll-1) == 'x') { mvCapture = 1; }
    if (isNaN(move.charAt(ll-1-mvCapture))) {
      mvFromCol = move.charCodeAt(ll-1-mvCapture) - 97;
      if ((mvFromCol < 0) || (mvFromCol > 7)) { mvFromCol = -1; }
    } else {
      mvFromRow = move.charAt(ll-1-mvCapture) - 1;
      if ((mvFromRow < 0) || (mvFromRow > 7)) { mvFromRow = -1; }
      else {
        mvFromCol = move.charCodeAt(ll-2-mvCapture) - 97;
        if ((mvFromCol < 0) || (mvFromCol > 7)) { mvFromCol = -1; }
      }
    }

    if ( (ll > 1) && (!mvCapture) && (mvFromCol == -1) && (mvFromRow == -1) ) { return false; }
    if ( (mvPiece == 6) && (!mvCapture) && (mvFromCol == -1) && (mvFromRow == -1) ) { return false; }
  }

  mvPieceOnTo = mvPiece;
  // "square to" occupied: capture (note en-passant case)
  if (Board[mvToCol][mvToRow] !== 0) { mvCapture = 1; }
  else {
    if ((mvPiece == 6) && (HistEnPassant[plyCount]) &&
        (mvToCol == HistEnPassantCol[plyCount]) &&
        (mvToRow == 5-3*MoveColor)) {
      mvCapture = 1;
    }
  }

  if (mvPiece == 6) {
    // move contains '=' or char after destination row: might be a promotion
    ii = move.indexOf('=');
    if (ii < 0) { ii = toRowMarker; }
    if ((ii > 0) && (ii < move.length-1)) {
      var newPiece = move.charAt(ii+1);
      if (newPiece == PieceCode[1]) { mvPieceOnTo = 2; }
      else if (newPiece == PieceCode[2]) { mvPieceOnTo = 3; }
      else if (newPiece == PieceCode[3]) { mvPieceOnTo = 4; }
      else if (newPiece == PieceCode[4]) { mvPieceOnTo = 5; }
      if (mvPieceOnTo != mvPiece) { mvIsPromotion = 1; }
    }
    if ((mvToRow == 7 * (1-MoveColor)) ? !mvIsPromotion : mvIsPromotion) { return false; }
  }

  // which captured piece: if nothing found must be en-passant
  if (mvCapture) {
    for (mvCapturedId = 15; mvCapturedId >= 0; mvCapturedId--) {
      if ((PieceType[1-MoveColor][mvCapturedId] >  0) &&
          (PieceCol[1-MoveColor][mvCapturedId] == mvToCol) &&
          (PieceRow[1-MoveColor][mvCapturedId] == mvToRow)) {
        mvCaptured = PieceType[1-MoveColor][mvCapturedId];
        if (mvCaptured == 1) { return false; }
        break;
      }
    }
    if ((mvPiece == 6) && (mvCapturedId < 1) && (HistEnPassant[plyCount])) {
      for (mvCapturedId = 15; mvCapturedId >= 0; mvCapturedId--) {
        if ((PieceType[1-MoveColor][mvCapturedId] == 6) &&
            (PieceCol[1-MoveColor][mvCapturedId] == mvToCol) &&
            (PieceRow[1-MoveColor][mvCapturedId] == 4-MoveColor)) {
          mvCaptured = PieceType[1-MoveColor][mvCapturedId];
          break;
        }
      }
    }
  }

  // check move legality
  if (!CheckLegality(PieceCode[mvPiece-1], plyCount)) { return false; }

  // pawn moved: check en-passant possibility
  HistEnPassant[plyCount+1] = false;
  HistEnPassantCol[plyCount+1] = -1;
  if (mvPiece == 6) {
     if (Math.abs(HistRow[0][plyCount]-mvToRow) == 2) {
       HistEnPassant[plyCount+1] = true;
       HistEnPassantCol[plyCount+1] = mvToCol;
     }
  }
  return true;
}

function SetGameSelectorOptions(head, num, chEvent, chSite, chRound, chWhite, chBlack, chResult, chDate) {
  if (head !== null) { gameSelectorHead = head; }
  if (num !== null) { gameSelectorNum = num; }
  if (chEvent !== null)  { gameSelectorChEvent  = chEvent  > 32 ? 32 : chEvent;  }
  if (chSite !== null)   { gameSelectorChSite   = chSite   > 32 ? 32 : chSite;   }
  if (chRound !== null)  { gameSelectorChRound  = chRound  > 32 ? 32 : chRound;  }
  if (chWhite !== null)  { gameSelectorChWhite  = chWhite  > 32 ? 32 : chWhite;  }
  if (chBlack !== null)  { gameSelectorChBlack  = chBlack  > 32 ? 32 : chBlack;  }
  if (chResult !== null) { gameSelectorChResult = chResult > 32 ? 32 : chResult; }
  if (chDate !== null)   { gameSelectorChDate   = chDate   > 32 ? 32 : chDate;   }
}

var clickedSquareInterval = null;
function clickedSquare(ii, jj) {
  if (clickedSquareInterval) { return; } // dont trigger twice
  squareId = 'tcol' + jj + 'trow' + ii;
  if (theObj = document.getElementById(squareId)) {
    var oldClass = theObj.className;
    theObj.className = (ii+jj)%2 === 0 ? "blackSquare" : "whiteSquare";
    clickedSquareInterval = setTimeout("reset_after_click(" + ii + "," + jj + ",'" + oldClass + "','" + theObj.className + "')", 66);
  }
}

function reset_after_click (ii, jj, oldClass, newClass) {
  if (theObj = document.getElementById('tcol' + jj + 'trow' + ii)) {
    // square class changed again by pgn4web already: dont touch it anymore e.g. autoplay
    if (theObj.className == newClass) { theObj.className = oldClass; }
    clickedSquareInterval = null;
  }
}


var lastSearchPgnExpression = "";
function gameNumberSearchPgn(searchExpression, backward, includeCurrent) {
  var searchThis;
  lastSearchPgnExpression = searchExpression;
  if (searchExpression === "") { return false; }
  // replace newline with spaces so that we can use regexp "." on whole game
  newlinesRegExp = new RegExp("[\n\r]", "gm");
  searchExpressionRegExp = new RegExp(searchExpression, "im");
  // at start currentGame might still be -1
  currentGameSearch = (currentGame < 0) || (currentGame >= numberOfGames) ? 0 : currentGame;
  searchThis = fullPgnGame(currentGameSearch);
  if (includeCurrent && searchThis.replace(newlinesRegExp, " ").match(searchExpressionRegExp)) {
    return currentGameSearch;
  }
  delta = backward ? -1 : +1;
  for (checkGame = (currentGameSearch + delta + numberOfGames) % numberOfGames;
       checkGame != currentGameSearch;
       checkGame = (checkGame + delta + numberOfGames) % numberOfGames) {
    searchThis = fullPgnGame(checkGame);
    if (searchThis.replace(newlinesRegExp, " ").match(searchExpressionRegExp)) {
      return checkGame;
    }
  }
  return false;
}

function searchPgnGame(searchExpression, backward) {
  lastSearchPgnExpression = searchExpression;
  if (theObj = document.getElementById('searchPgnExpression'))
  { theObj.value = searchExpression; }
  if ((searchExpression === "") || (!searchExpression)) { return; }
  if (numberOfGames < 2) { return; }
  checkGame = gameNumberSearchPgn(searchExpression, backward, false);
  if ((checkGame !== false) && (checkGame != currentGame)) { Init(checkGame); }
}

function searchPgnGamePrompt() {
  if (numberOfGames < 2) {
    alert("info: search prompt disabled with less than 2 games");
    return;
  }
  searchExpression = prompt("Please enter search pattern for PGN games:", lastSearchPgnExpression);
  if (searchExpression) { searchPgnGame(searchExpression); }
}

function searchPgnGameForm() {
  if (theObj = document.getElementById('searchPgnExpression'))
  { searchPgnGame(document.getElementById('searchPgnExpression').value); }
}

function fixCommentForDisplay(comment) {
  chessMovesRegExp = new RegExp("((\\d+(\\.|\\.\\.\\.)?\\s*)?([KQRBNP]?[a-h1-8]?x?[a-h][1-8](=[QRNB])?|O-O-O|O-O)[!?+#]?)", "g");
  return comment.replace(chessMovesRegExp, '<SPAN STYLE="white-space: nowrap;" CLASS="commentMove">$1</SPAN>');
}

var tableSize = 0;
function PrintHTML() {
  var ii, jj;
  var text;
  var theObj;

  // chessboard

  if (theObj = document.getElementById("GameBoard")) {
    text = '<TABLE CLASS="boardTable" ID="boardTable" CELLSPACING=0 CELLPADDING=0';
    text += (tableSize > 0) ? ' STYLE="width: ' + tableSize + 'px; height: ' + tableSize + 'px;">' : '>';
    for (ii = 0; ii < 8; ++ii) {
      text += '<TR>';
      for (jj = 0; jj < 8; ++jj) {
        squareId = 'tcol' + jj + 'trow' + ii;
        imageId = 'img_' + squareId;
        text += (ii+jj)%2 === 0 ?
          '<TD CLASS="whiteSquare" ID="' + squareId + '" BGCOLOR="#FFFFFF"' :
          '<TD CLASS="blackSquare" ID="' + squareId + '" BGCOLOR="#D3D3D3"';
        text += ' ALIGN="center" VALIGN="middle" ONCLICK="clickedSquare(' + ii + ',' + jj + ')">';
        squareCoord = IsRotated ? String.fromCharCode(72-jj,49+ii) : String.fromCharCode(jj+65,56-ii);
        squareTitle = squareCoord;
        if (boardTitle[jj][ii] !== '') { squareTitle += ': ' + boardTitle[jj][ii]; }
        text += '<IMG SRC="'+ ClearImg.src + '" ' +
          'CLASS="pieceImage" STYLE="border-style: none; outline: none;" ' +
          'ONCLICK="boardOnClick[' + jj + '][' + ii + '](this, event);" ' +
          'ID="' + imageId + '" TITLE="' + squareTitle + '" ' + 'ONFOCUS="this.blur()" />' +
          '</TD>';
      }
      text += '</TR>';
    }
    text += '</TABLE>';

    theObj.innerHTML = text;
  }

  if (theObj = document.getElementById("boardTable")) {
    tableSize = theObj.offsetWidth;
    if (tableSize > 0) { // coping with browser always returning 0 to offsetWidth
      theObj.style.height = tableSize + "px";
    }
  }

  // control buttons

  if (theObj = document.getElementById("GameButtons")) {
    numberOfButtons = 5;
    spaceSize = 3;
    buttonSize = (tableSize - spaceSize*(numberOfButtons - 1)) / numberOfButtons;
    text = '<FORM NAME="GameButtonsForm" STYLE="display:inline;">' +
      '<TABLE BORDER="0" CELLPADDING="0" CELLSPACING="0">' +
      '<TR><TD>' +
      '<INPUT ID="startButton" TYPE="BUTTON" VALUE="&lt;&lt;" STYLE="';
    if (buttonSize > 0) { text += 'width: ' + buttonSize + 'px;'; }
    text += '"; CLASS="buttonControl" TITLE="go to game start" ' +
      ' ID="btnGoToStart" onClick="clickedBbtn(this,event);" ONFOCUS="this.blur();">' +
      '</TD>' +
      '<TD CLASS="buttonControlSpace" WIDTH="' + spaceSize + '">' +
      '</TD><TD>' +
      '<INPUT ID="backButton" TYPE="BUTTON" VALUE="&lt;" STYLE="';
    if (buttonSize > 0) { text += 'width: ' + buttonSize + 'px;'; }
    text += '"; CLASS="buttonControl" TITLE="move backward" ' +
      ' ID="btnMoveBackward1" onClick="clickedBbtn(this,event);" ONFOCUS="this.blur();">' +
      '</TD>' +
      '<TD CLASS="buttonControlSpace" WIDTH="' + spaceSize + '">' +
      '</TD><TD>';
    text += '<INPUT ID="autoplayButton" TYPE="BUTTON" VALUE=' +
      (isAutoPlayOn ? "=" : "+") + ' STYLE="';
    if (buttonSize > 0) { text += 'width: ' + buttonSize + 'px;'; }
    text += isAutoPlayOn ?
      '"; CLASS="buttonControlStop" TITLE="toggle autoplay (stop)" ' :
      '"; CLASS="buttonControlPlay" TITLE="toggle autoplay (start)" ';
    text += ' ID="btnPlay" NAME="AutoPlay" onClick="clickedBbtn(this,event);" ONFOCUS="this.blur();">' +
      '</TD>' +
      '<TD CLASS="buttonControlSpace" WIDTH="' + spaceSize + '">' +
      '</TD><TD>' +
      '<INPUT ID="forwardButton" TYPE="BUTTON" VALUE="&gt;" STYLE="';
    if (buttonSize > 0) { text += 'width: ' + buttonSize + 'px;'; }
    text += '"; CLASS="buttonControl" TITLE="move forward" ' +
      ' ID="btnMoveForward1" onClick="clickedBbtn(this,event);" ONFOCUS="this.blur();">' +
      '</TD>' +
      '<TD CLASS="buttonControlSpace" WIDTH="' + spaceSize + '">' +
      '</TD><TD>' +
      '<INPUT ID="endButton" TYPE="BUTTON" VALUE="&gt;&gt;" STYLE="';
    if (buttonSize > 0) { text += 'width: ' + buttonSize + 'px;'; }
    text += '"; CLASS="buttonControl" TITLE="go to game end" ' +
      ' ID="btnGoToEnd" onClick="clickedBbtn(this,event);" ONFOCUS="this.blur();">' +
      '</TD></TR></TABLE></FORM>';

    theObj.innerHTML = text;
  }

  // game selector

  if (theObj = document.getElementById("GameSelector")) {
    if (firstStart) { textSelectOptions=''; }
    if (numberOfGames < 2) {
      // theObj.innerHTML = ''; // replaced with code below to cope with IE bug
      while (theObj.firstChild) { theObj.removeChild(theObj.firstChild); }
      textSelectOptions = '';
    } else {
      if (textSelectOptions === '') {
        if (gameSelectorNum) { gameSelectorNumLenght = Math.floor(Math.log(numberOfGames)/Math.log(10)) + 1; }
        text = '<FORM NAME="GameSel" STYLE="display:inline;"> ' +
          '<SELECT ID="GameSelSelect" NAME="GameSelSelect" STYLE="';
        if (tableSize > 0) { text += 'width: ' + tableSize + 'px; '; }
        text += 'font-family: monospace;" CLASS="selectControl" TITLE="select a game" ' +
          'ONCHANGE="this.blur(); if (this.value >= 0) { Init(this.value); this.value = -1; }" ' +
          'ONFOCUS="disableShortcutKeysAndStoreStatus();" ONBLUR="restoreShortcutKeysStatus();" ' +
          '> ' +
          '<OPTION CLASS="optionSelectControl" value=-1>';

        blanks = ''; for (ii=0; ii<32; ii++) { blanks += ' '; }
        if (gameSelectorNum) {
          gameSelectorHeadDisplay = blanks.substring(0, gameSelectorNumLenght) + '  ' + gameSelectorHead;
        } else {
          gameSelectorHeadDisplay = gameSelectorHead;
        }
        // replace spaces with &nbsp;
        text += gameSelectorHeadDisplay.replace(/ /g, '&nbsp;');

        for (ii=0; ii<numberOfGames; ii++) {
          textSelectOptions += '<OPTION CLASS="optionSelectControl" value=' + ii + '>';
          textSO = '';
          if (gameSelectorNum) {
            numText = ' ' + (ii+1);
            textSO += blanks.substr(0, gameSelectorNumLenght - (numText.length - 1)) +
              numText + ' ';
          }
          if (gameSelectorChEvent > 0) {
            textSO += ' ' + gameEvent[ii].substring(0, gameSelectorChEvent) +
              blanks.substr(0, gameSelectorChEvent - gameEvent[ii].length) + ' ';
          }
          if (gameSelectorChSite > 0) {
            textSO += ' ' + gameSite[ii].substring(0, gameSelectorChSite) +
              blanks.substr(0, gameSelectorChSite - gameSite[ii].length) + ' ';
          }
          if (gameSelectorChRound > 0) {
            textSO += ' ' + blanks.substr(0, gameSelectorChRound - gameRound[ii].length) +
              gameRound[ii].substring(0, gameSelectorChRound) + ' ';
          }
          if (gameSelectorChWhite > 0) {
            textSO += ' ' + gameWhite[ii].substring(0, gameSelectorChWhite) +
              blanks.substr(0, gameSelectorChWhite - gameWhite[ii].length) + ' ';
          }
          if (gameSelectorChBlack > 0) {
            textSO += ' ' + gameBlack[ii].substring(0, gameSelectorChBlack) +
              blanks.substr(0, gameSelectorChBlack - gameBlack[ii].length) + ' ';
          }
          if (gameSelectorChResult > 0) {
            textSO += ' ' + gameResult[ii].substring(0, gameSelectorChResult) +
              blanks.substr(0, gameSelectorChResult - gameResult[ii].length) + ' ';
          }
          if (gameSelectorChDate > 0) {
            textSO += ' ' + gameDate[ii].substring(0, gameSelectorChDate) +
              blanks.substr(0, gameSelectorChDate - gameDate[ii].length) + ' ';
          }
          // replace spaces with &nbsp;
          textSelectOptions += textSO.replace(/ /g, '&nbsp;');
        }
        text += textSelectOptions + '</SELECT></FORM>';
        theObj.innerHTML = text;
      }
    }
  }

  // game event

  if (theObj = document.getElementById("GameEvent"))
  { theObj.innerHTML = gameEvent[currentGame]; }

  // game round

  if (theObj = document.getElementById("GameRound"))
  { theObj.innerHTML = gameRound[currentGame]; }

  // game site

  if (theObj = document.getElementById("GameSite"))
  { theObj.innerHTML = gameSite[currentGame]; }

  // game date

  if (theObj = document.getElementById("GameDate")) {
    theObj.innerHTML = gameDate[currentGame];
    theObj.style.whiteSpace = "nowrap";
  }

  // game white

  if (theObj = document.getElementById("GameWhite"))
  { theObj.innerHTML = gameWhite[currentGame]; }

  // game black

  if (theObj = document.getElementById("GameBlack"))
  { theObj.innerHTML = gameBlack[currentGame]; }

  // game result

  if (theObj = document.getElementById("GameResult")) {
    theObj.innerHTML = gameResult[currentGame];
    theObj.style.whiteSpace = "nowrap";
  }

  // game text

  if (theObj = document.getElementById("GameText")) {
    variationTextDepth = -1;
    text = '<SPAN ID="ShowPgnText">' + variationTextFromId(0); + '</SPAN>';
    theObj.innerHTML = text;
  }

  setB1C1F1G1boardShortcuts(); // depend on presence of comments

  // game searchbox

  if ((theObj = document.getElementById("GameSearch")) && firstStart) {
    if (numberOfGames < 2) {
      // theObj.innerHTML = ''; // replaced with code below to cope with IE bug
      while (theObj.firstChild) { theObj.removeChild(theObj.firstChild); }
    } else {
      text = '<FORM ID="searchPgnForm" STYLE="display: inline;" ' +
        'ACTION="javascript:searchPgnGameForm();">';
      text += '<INPUT ID="searchPgnButton" CLASS="searchPgnButton" STYLE="display: inline; ';
      if (tableSize > 0) { text += 'width: ' + (tableSize/4) + 'px; '; }
      text += '" TITLE="find games matching the search string (regular expression)" ' +
        'TYPE="submit" VALUE="?">' +
        '<INPUT ID="searchPgnExpression" CLASS="searchPgnExpression" ' +
        'TITLE="find games matching the search string (regular expression)" ' +
        'TYPE="input" VALUE="" STYLE="display: inline; ';
      if (tableSize > 0) { text += 'width: ' + (3*tableSize/4) + 'px; '; }
      text += '" ONFOCUS="disableShortcutKeysAndStoreStatus();" ONBLUR="restoreShortcutKeysStatus();">';
      text += '</FORM>';
      theObj.innerHTML = text;
      theObj = document.getElementById('searchPgnExpression');
      if (theObj) { theObj.value = lastSearchPgnExpression; }
    }
  }
}

function startButton(e) {
  if (e.shiftKey) {
    if (CurrentPly <= StartPlyVar[CurrentVar] + 1) {
      GoToMove(StartPlyVar[CurrentVar]);
    } else {
      GoToMove(StartPlyVar[CurrentVar] + 1);
    }
  } else { GoToMove(StartPlyVar[0], 0); }
}

function backButton(e) {
  if (e.shiftKey) { GoToMove(StartPlyVar[CurrentVar]); }
  else { GoToMove(CurrentPly - 1); }
}

function forwardButton(e) {
  if (e.shiftKey) { if (!goToNextVariationSibling()) { GoToMove(CurrentPly + 1); } }
  else { GoToMove(CurrentPly + 1); }
}

function endButton(e) {
  if (e.shiftKey) {
    if (CurrentPly === StartPlyVar[CurrentVar] + PlyNumberVar[CurrentVar]) {
      goToFirstChild();
    } else {
      GoToMove(StartPlyVar[CurrentVar] + PlyNumberVar[CurrentVar]);
    }
  } else { GoToMove(StartPlyVar[0] + PlyNumberVar[0], 0); }
}

function clickedBbtn(t,e) {
  switch (t.id) {
    case "startButton":
      startButton(e);
      break;
    case "backButton":
      backButton(e);
      break;
    case "autoplayButton":
      if (e.shiftKey) { goToNextVariationSibling(); }
      else { SwitchAutoPlay(); }
      break;
    case "forwardButton":
      forwardButton(e);
      break;
    case "endButton":
      endButton(e);
      break;
    default:
      break;
  }
}

var basicNAGs = /^[\?!+#\s]+(\s|$)/;
function strippedMoveComment(plyNum, varId, addHtmlTags) {
  if (typeof(addHtmlTags) == "undefined") { addHtmlTags = false; }
  if (typeof(varId) == "undefined") { varId = CurrentVar; }
  if (!MoveCommentsVar[varId][plyNum]) { return ""; }
  return fixCommentForDisplay(MoveCommentsVar[varId][plyNum]).replace(pgn4webVariationRegExpGlobal, function (m) { return variationTextFromTag(m, addHtmlTags); }).replace(/\[%[^\]]*\]\s*/g,'').replace(basicNAGs, '').replace(/^\s+$/,'');
}

function basicNAGsMoveComment(plyNum, varId) {
  if (typeof(varId) == "undefined") { varId = CurrentVar; }
  if (!MoveCommentsVar[varId][plyNum]) { return ""; }
  thisBasicNAGs = MoveCommentsVar[varId][plyNum].replace(/\[%[^\]]*\]\s*/g,'').match(basicNAGs, '');
  return thisBasicNAGs ? thisBasicNAGs[0].replace(/\s+(?!class=)/gi,'') : '';
}

function variationTextFromTag(variationTag, addHtmlTags) {
  if (typeof(addHtmlTags) == "undefined") { addHtmlTags = false; }
  var varId = variationTag.replace(pgn4webVariationRegExp, "$1");
  if (isNaN(varId)) {
    myAlert("error: issue parsing variation tag " + variationTag + " in game " + (currentGame+1), true);
    return "";
  }
  var text = variationTextFromId(varId);
  if (text) {
    if (addHtmlTags) { text = '</SPAN>' + text + '<SPAN CLASS="comment">'; }
  } else { text = ''; }
  return text;
}

var variationTextDepth;
function variationTextFromId(varId) {
  var punctChars = ",.;:!?", thisComment;

  if (isNaN(varId) || varId < 0 || varId >= numberOfVars || typeof(StartPlyVar[varId]) == "undefined" || typeof(PlyNumberVar[varId]) == "undefined") {
    myAlert("error: issue parsing variation id " + varId + " in game " + (currentGame+1), true);
    return "";
  }
  var text = ++variationTextDepth ? ('<SPAN CLASS="variation">' + (printedVariation ? ' ' : '') + (variationTextDepth > 1 ? '(' : '[')) + '</SPAN>' : '';
  printedVariation = false;
  for (var ii = StartPlyVar[varId]; ii < StartPlyVar[varId] + PlyNumberVar[varId]; ii++) {
    printedComment = false;
    if (commentsIntoMoveText && (thisComment = strippedMoveComment(ii, varId, true))) {
      if (commentsOnSeparateLines && variationTextDepth === 0 && ii > StartPlyVar[varId]) {
        text += '<DIV CLASS="comment" STYLE="line-height: 33%;">&nbsp;</DIV>';
      }
      if (printedVariation) { if (punctChars.indexOf(thisComment.charAt(0)) == -1) { text += '<SPAN CLASS="variation"> </SPAN>'; } }
      else { printedVariation = variationTextDepth > 0; }
      text += '<SPAN CLASS="comment">' + thisComment + '</SPAN>';
      if (commentsOnSeparateLines && variationTextDepth === 0) {
        text += '<DIV CLASS="comment" STYLE="line-height: 33%;">&nbsp;</DIV>';
      }
      printedComment = true;
    }
    if (printedComment || printedVariation) { text += '<SPAN CLASS="variation"> </SPAN>'; }
    printedVariation = true;

    text += printMoveText(ii, varId, (variationTextDepth > 0), ((printedComment) || (ii == StartPlyVar[varId])), true);
  }
  if (commentsIntoMoveText && (thisComment = strippedMoveComment(StartPlyVar[varId] + PlyNumberVar[varId], varId, true))) {
    if (commentsOnSeparateLines && variationTextDepth === 0) {
      text += '<DIV CLASS="comment" STYLE="line-height: 33%;">&nbsp;</DIV>';
    }
    if (printedVariation && (punctChars.indexOf(thisComment.charAt(0)) == -1)) { text += '<SPAN CLASS="comment notranslate"> </SPAN>'; }
    text += '<SPAN CLASS="comment">' + thisComment + '</SPAN>';
    printedComment = true;
  }
  text += variationTextDepth-- ? ('<SPAN CLASS="variation">' + (variationTextDepth ? ')' : ']') + '</SPAN>') : '';
  printedVariation = true;
  return text;
}

function printMoveText(thisPly, thisVar, isVar, hasLeadingNum, hasId) {
  if (typeof(thisVar) == "undefined") { thisVar = CurrentVar; }
  if (typeof(thisPly) == "undefined") { thisPly = CurrentPly; }
  text = '';

  if (thisVar >= numberOfVars ||
      thisPly < StartPlyVar[thisVar] ||
      thisPly > StartPlyVar[thisVar] + PlyNumberVar[thisVar]) {
    return text;
  }

  var moveCount = Math.floor(thisPly/2)+1;
  if (thisPly%2 === 0) {
    text += '<SPAN CLASS="' + (isVar ? 'variation' : 'move') +
      ' notranslate">' + moveCount + '.&nbsp;</SPAN>';
  } else {
    if (hasLeadingNum) {
      text += '<SPAN CLASS="' + (isVar ? 'variation' : 'move') +
        ' notranslate">' + moveCount + '...&nbsp;</SPAN>';
    }
  }
  var jj = thisPly+1;
  text += '<A HREF="javascript:void(0);" ONCLICK="GoToMove(' + jj + ', ' + thisVar + ');" ' +
    'CLASS="' + (isVar ? 'variation' : 'move') + ' notranslate" ' +
    (hasId ? ('ID="Var' + thisVar + 'Mv' + jj + '" ') : '') +
    'ONFOCUS="this.blur();">' + MovesVar[thisVar][thisPly];
  if (commentsIntoMoveText) { text += basicNAGsMoveComment(jj, thisVar); }
  text += '</A>';

  return text;
}


// undocumented API to autoscroll gane text to show current move
// enable with "enableAutoScrollToCurrentMove(objectId)", with objectId as the game text container
// add onresize="autoScrollToCurrentMoveIfEnabled" to the body tag for autoscrolling on page resize

function enableAutoScrollToCurrentMove(objectId) { autoScrollToCurrentMove_objectId = objectId; }
function disableAutoScrollToCurrentMove() { autoScrollToCurrentMove_objectId = ""; }
function toggleAutoScrollToCurrentMove(objectId) { autoScrollToCurrentMove_objectId = autoScrollToCurrentMove_objectId ? "" : objectId; }

var autoScrollToCurrentMove_objectId = "";
function autoScrollToCurrentMoveIfEnabled() { autoScrollToCurrentMove(autoScrollToCurrentMove_objectId); }

function objectOffsetVeryTop(object) {
  for (offset = object.offsetTop; object = object.offsetParent; /* */) { offset += object.offsetTop + object.clientTop; }
  return offset;
}

function autoScrollToCurrentMove(objectId) {
  if (objectId && (theContainerObject = document.getElementById(objectId))) {
    if (CurrentPly == StartPly) { theContainerObject.scrollTop = 0; }
    else if (theMoveObject = document.getElementById('Var' + CurrentVar + 'Mv' + CurrentPly)) {
      theContainerObjectOffsetVeryTop = objectOffsetVeryTop(theContainerObject);
      theMoveObjectOffsetVeryTop = objectOffsetVeryTop(theMoveObject);
      if ((theMoveObjectOffsetVeryTop + theMoveObject.offsetHeight >
           theContainerObjectOffsetVeryTop + theContainerObject.scrollTop + theContainerObject.clientHeight) ||
          (theMoveObjectOffsetVeryTop < theContainerObjectOffsetVeryTop + theContainerObject.scrollTop)) {
        theContainerObject.scrollTop = theMoveObjectOffsetVeryTop - theContainerObjectOffsetVeryTop;
      }
    }
  }
}


function FlipBoard() {
  tmpHighlightOption = highlightOption;
  if (tmpHighlightOption) { SetHighlight(false); }
  IsRotated = !IsRotated;
  PrintHTML();
  RefreshBoard();
  if (tmpHighlightOption) { SetHighlight(true); }
}

function RefreshBoard() {
  var col, row, square;
  for (col = 0; col < 8;++col) {
    for (row = 0; row < 8; ++row) {
      if (Board[col][row] === 0) { SetImage(col, row, ClearImg.src); }
    }
  }
  var color, ii;
  for (color = 0; color < 2; ++color) {
    for (ii = 0; ii < 16; ++ii) {
      if (PieceType[color][ii] > 0) {
        SetImage(PieceCol[color][ii], PieceRow[color][ii], PiecePicture[color][PieceType[color][ii]].src);
      }
    }
  }
}

function SetAutoPlay(vv) {
  isAutoPlayOn = vv;

  if (AutoPlayInterval) { clearTimeout(AutoPlayInterval); AutoPlayInterval = null; }

  if (isAutoPlayOn) {
    if (document.GameButtonsForm) {
      if (document.GameButtonsForm.AutoPlay) {
        document.GameButtonsForm.AutoPlay.value = "=";
        document.GameButtonsForm.AutoPlay.title = "toggle autoplay (stop)";
        document.GameButtonsForm.AutoPlay.className = "buttonControlStop";
      }
    }
    if (CurrentPly < StartPlyVar[CurrentVar] + PlyNumberVar[CurrentVar]) { AutoPlayInterval=setTimeout("MoveForward(1)", Delay); }
    else {
      if (autoplayNextGame && (CurrentVar === 0)) { AutoPlayInterval=setTimeout("AutoplayNextGame()", Delay); }
      else { SetAutoPlay(false); }
    }
  } else {
    if (document.GameButtonsForm) {
      if (document.GameButtonsForm.AutoPlay) {
        document.GameButtonsForm.AutoPlay.value = "+";
        document.GameButtonsForm.AutoPlay.title = "toggle autoplay (start)";
        document.GameButtonsForm.AutoPlay.className = "buttonControlPlay";
      }
    }
  }
}


var minAutoplayDelay = 500;
var maxAutoplayDelay = 300000;
function setCustomAutoplayDelay() {
  if ((newDelaySec = prompt("Enter custom autoplay delay, in seconds, between " + (minAutoplayDelay/1000) + " and " + (maxAutoplayDelay/1000) + ":", Math.floor(Delay / 100) / 10)) && (!isNaN(newDelaySec = parseInt(newDelaySec, 10)))) {
    SetAutoplayDelayAndStart(newDelaySec * 1000);
  }
}

function SetAutoplayDelay(vv) {
  if (isNaN(vv = parseInt(vv, 10))) { return; }
  Delay = Math.min(Math.max(vv, minAutoplayDelay), maxAutoplayDelay);
}

function SetAutoplayDelayAndStart(vv) {
  MoveForward(1);
  SetAutoplayDelay(vv);
  SetAutoPlay(true);
}

function SetLiveBroadcast(delay, alertFlag, demoFlag, stepFlag) {
  LiveBroadcastDelay = delay; // zero delay: no live broadcast
  LiveBroadcastAlert = (alertFlag === true);
  LiveBroadcastDemo = (demoFlag === true);
  LiveBroadcastSteppingMode = (stepFlag === true);
}

function SetImage(col, row, image) {
  if (IsRotated) { trow = row; tcol = 7 - col; }
  else { trow = 7 - row; tcol = col; }
  if (theObj = document.getElementById('img_' + 'tcol' + tcol + 'trow' + trow)) {
    if (theObj.src != image) { theObj.src = image; }
  }
}

function SetImagePath(path) {
  ImagePath = path;
}

function SwitchAutoPlay() {
  if (isAutoPlayOn) { SetAutoPlay(false); }
  else {
    MoveForward(1);
    SetAutoPlay(true);
  }
}

function StoreMove(thisPly) {

  HistVar[thisPly+1] = CurrentVar;

  if (HistNull[thisPly] = mvIsNull) { return; }

  // "square from" history
  HistPieceId[0][thisPly] = mvPieceId;
  HistCol[0][thisPly] = PieceCol[MoveColor][mvPieceId];
  HistRow[0][thisPly] = PieceRow[MoveColor][mvPieceId];
  HistType[0][thisPly] = PieceType[MoveColor][mvPieceId];

  // "square to" history
  HistCol[2][thisPly] = mvToCol;
  HistRow[2][thisPly] = mvToRow;

  if (mvIsCastling) {
    HistPieceId[1][thisPly] = castleRook;
    HistCol[1][thisPly] = PieceCol[MoveColor][castleRook];
    HistRow[1][thisPly] = PieceRow[MoveColor][castleRook];
    HistType[1][thisPly] = PieceType[MoveColor][castleRook];
  } else if (mvCapturedId >= 0) {
    HistPieceId[1][thisPly] = mvCapturedId+16;
    HistCol[1][thisPly] = PieceCol[1-MoveColor][mvCapturedId];
    HistRow[1][thisPly] = PieceRow[1-MoveColor][mvCapturedId];
    HistType[1][thisPly] = PieceType[1-MoveColor][mvCapturedId];
  } else {
    HistPieceId[1][thisPly] = -1;
  }

  // update "square from" and captured square (not necessarily "square to" e.g. en-passant)
  Board[PieceCol[MoveColor][mvPieceId]][PieceRow[MoveColor][mvPieceId]] = 0;

  // mark captured piece
  if (mvCapturedId >= 0) {
     PieceType[1-MoveColor][mvCapturedId] = -1;
     PieceMoveCounter[1-MoveColor][mvCapturedId]++;
     Board[PieceCol[1-MoveColor][mvCapturedId]][PieceRow[1-MoveColor][mvCapturedId]] = 0;
  }

  // update piece arrays: promotion changes piece type
  PieceType[MoveColor][mvPieceId] = mvPieceOnTo;
  PieceMoveCounter[MoveColor][mvPieceId]++;
  PieceCol[MoveColor][mvPieceId] = mvToCol;
  PieceRow[MoveColor][mvPieceId] = mvToRow;
  if (mvIsCastling) {
    PieceMoveCounter[MoveColor][castleRook]++;
    PieceCol[MoveColor][castleRook] = mvToCol == 2 ? 3 : 5;
    PieceRow[MoveColor][castleRook] = mvToRow;
  }

  // update board
  Board[mvToCol][mvToRow] = PieceType[MoveColor][mvPieceId]*(1-2*MoveColor);
  if (mvIsCastling) {
    Board[PieceCol[MoveColor][castleRook]][PieceRow[MoveColor][castleRook]] =
      PieceType[MoveColor][castleRook]*(1-2*MoveColor);
  }
  return;
}

function UndoMove(thisPly) {

  if (HistNull[thisPly]) { return; }

  // moved piece back
  Board[mvToCol][mvToRow] = 0;
  Board[HistCol[0][thisPly]][HistRow[0][thisPly]] =
    HistType[0][thisPly]*(1-2*MoveColor);

  PieceCol[MoveColor][mvPieceId] = HistCol[0][thisPly];
  PieceRow[MoveColor][mvPieceId] = HistRow[0][thisPly];
  PieceType[MoveColor][mvPieceId] = HistType[0][thisPly];
  PieceMoveCounter[MoveColor][mvPieceId]--;

  // capture/castle: captured/rook back
  if (mvCapturedId >= 0) {
     PieceType[1-MoveColor][mvCapturedId] = mvCapturedId;
     PieceCol[1-MoveColor][mvCapturedId] = HistCol[1][thisPly];
     PieceRow[1-MoveColor][mvCapturedId] = HistRow[1][thisPly];
     PieceCol[1-MoveColor][mvCapturedId] = HistCol[1][thisPly];
  } else if (mvIsCastling) {
     PieceCol[MoveColor][castleRook] = HistCol[1][thisPly];
     PieceRow[MoveColor][castleRook] = HistRow[1][thisPly];
     PieceMoveCounter[MoveColor][castleRook]--;
  }
}

function Color(nn) {
  if (nn < 0) { return 1; }
  if (nn > 0) { return 0; }
  return 2;
}

function sign(nn) {
  if (nn > 0) { return  1; }
  if (nn < 0) { return -1; }
  return 0;
}

function SquareOnBoard(col, row) {
  return col >= 0 && col <= 7 && row >= 0 && row <= 7;
}
