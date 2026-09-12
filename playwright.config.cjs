const {defineConfig}=require('@playwright/test')
module.exports=defineConfig({testDir:'test/ui',workers:1,timeout:45000,reporter:'./scripts/test-reporter.cjs',use:{trace:'retain-on-failure'},outputDir:'test-results'})
