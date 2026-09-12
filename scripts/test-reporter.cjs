class Reporter {
  onTestEnd(test, result) {
    console.log(`${result.status}: ${test.title}`)
    for (const error of result.errors || [])
      console.log(
        (error.message || '').replace(/\u001b\[[0-9;]*m/g, '').slice(0, 3000)
      )
  }
  onEnd(result) {
    console.log(`UI test run: ${result.status}`)
  }
}
module.exports = Reporter
