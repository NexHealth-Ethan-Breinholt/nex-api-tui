import { SyntaxStyle, RGBA } from "@opentui/core";

export const THEME = {
  accent:          "#7aa2f7",  // active borders, focused labels, selected text
  muted:           "#565f89",  // secondary text, descriptions, optional labels
  dim:             "#414868",  // inactive borders, separators, very dim text
  text:            "#a9b1d6",  // primary text
  error:           "#f7768e",  // error states
  success:         "#9ece6a",  // success / result states
  listFocusedBg:   "#1a1b26",  // focused row background in select lists
  listSelectedBg:  "#283457",  // selected row background in select lists
  headerBg:        "#16161e",  // top header bar background
};

// tealgreen - #108c77
// sync 50 - #f2fffd
// sync 100 - #d9fff8
// sync 200 - #b2fff2
// sync 400 - #33ffdc
// sync 500 - #1ae5c2

export const JSON_SYNTAX_STYLE = SyntaxStyle.fromStyles({
  string:             { fg: RGBA.fromHex("#ffffff") },
  number:             { fg: RGBA.fromHex("#5ccff5") },
  keyword:            { fg: RGBA.fromHex("#bb9af7") },
  "constant.builtin": { fg: RGBA.fromHex("#ff9e64") },
  default:            { fg: RGBA.fromHex("#444444") },
});
