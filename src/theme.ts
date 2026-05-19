import { SyntaxStyle, RGBA } from "@opentui/core";

export const JSON_SYNTAX_STYLE = SyntaxStyle.fromStyles({
  string:           { fg: RGBA.fromHex("#ffffff") },
  number:           { fg: RGBA.fromHex("#5ccff5") },
  keyword:          { fg: RGBA.fromHex("#bb9af7") },
  "constant.builtin": { fg: RGBA.fromHex("#ff9e64") },
  default:          { fg: RGBA.fromHex("#444444") },
});
