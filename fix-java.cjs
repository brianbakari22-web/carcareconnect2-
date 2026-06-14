const fs = require("fs");
function fixFile(fp) {
  if (!fs.existsSync(fp)) return;
  let c = fs.readFileSync(fp, "utf8");
  if (c.includes("VERSION_21")) {
    c = c.replace(/VERSION_21/g, "VERSION_17");
    fs.writeFileSync(fp, c, "utf8");
    console.log("Fixed: " + fp);
  }
}
fixFile("android/app/capacitor.build.gradle");
fixFile("android/build.gradle");
fixFile("android/capacitor-cordova-android-plugins/build.gradle");
