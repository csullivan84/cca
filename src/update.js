// Independent builds must never offer upstream binaries as their own updates.
async function checkForUpdates() {
    return false
}

module.exports = { checkForUpdates }
