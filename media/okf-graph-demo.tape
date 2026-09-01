# VHS Demo: okf-graph validation and neighborhood exploration

# --- Dependencies ---
Require bun

# --- Configuration ---
Output media/okf-graph-demo.gif
Set Shell "zsh"
Set FontSize 18
Set Width 950
Set Height 380
Set TypingSpeed 25ms
Set WindowBar Colorful
Set Padding 20

# --- Setup ---
Hide
Type "alias okf-graph='bun apps/okf-graph/src/index.ts'" Enter
Type "clear" Enter
Show

# --- Demo ---
Sleep 300ms
Type "okf-graph validate examples/house-plants-okf" Enter
Sleep 1s

Enter
Type "okf-graph graph neighbors examples/house-plants-okf propagation/leaf-cuttings" Enter
Sleep 4s
