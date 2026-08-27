/**
 * Automated profiling script for bulk annotation rendering performance.
 *
 * Usage:
 *   node scripts/profile-bulk-annotations.mjs [studyUrl]
 *
 * Requires the slim dev server to be running on port 3000.
 */

import { chromium } from 'playwright'

const DEFAULT_STUDY_URL = 'http://localhost:3000/studies/2.25.68803095896966276583382138924964839274/series/1.3.6.1.4.1.5962.99.1.1139028448.995765201.1637521600992.2.0?profile=1'

async function main() {
  const studyUrl = process.argv[2] || DEFAULT_STUDY_URL
  console.log('Starting profiling session...')
  console.log('Study URL:', studyUrl)

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--ignore-gpu-blocklist',
      '--disable-dev-shm-usage',
    ],
  })

  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
  })

  const page = await context.newPage()

  // Capture all console logs for debugging
  page.on('console', msg => {
    const text = msg.text()
    // Log all messages to see what's happening
    console.log(`[${msg.type()}] ${text}`)
  })

  console.log('\n1. Loading study...')
  await page.goto(studyUrl)

  // Wait for the viewer to load
  await page.waitForSelector('.ol-viewport', { timeout: 120000 })
  console.log('   Viewer loaded')

  // Wait for initial render
  await page.waitForTimeout(5000)

  // Take screenshot to see the UI
  await page.screenshot({ path: '/tmp/profiler-ui.png' })
  console.log('   Screenshot saved to /tmp/profiler-ui.png')

  // First click the annotation group to trigger loading (profiler loads lazily)
  console.log('\n2. Finding and clicking annotation group toggle...')

  // First, expand the Annotations submenu by clicking its title
  console.log('   Looking for Annotations submenu...')
  const annotationsSubmenu = await page.$('text=Annotations >> xpath=ancestor::li[contains(@class, "ant-menu-submenu")]')
  if (annotationsSubmenu) {
    // Click the submenu title to expand it
    const submenuTitle = await annotationsSubmenu.$('.ant-menu-submenu-title')
    if (submenuTitle) {
      await submenuTitle.click()
      console.log('   Clicked to expand Annotations submenu')
      await page.waitForTimeout(1000)
    }
  }

  // Now find and click the first visible switch inside the annotation groups
  const visibleSwitches = await page.$$('.ant-switch:visible')
  console.log(`   Found ${visibleSwitches.length} visible switches`)

  if (visibleSwitches.length > 0) {
    // Find first unchecked switch
    let clicked = false
    for (const switchEl of visibleSwitches) {
      const isChecked = await switchEl.evaluate(el => el.classList.contains('ant-switch-checked'))
      if (!isChecked) {
        await switchEl.click()
        console.log('   Clicked an unchecked annotation group switch')
        clicked = true
        break
      }
    }
    if (!clicked && visibleSwitches.length > 0) {
      console.log('   All switches checked, clicking first one')
      await visibleSwitches[0].click()
    }
  } else {
    console.log('   WARNING: No visible switches found!')
    // Take a debug screenshot
    await page.screenshot({ path: '/tmp/profiler-no-switches.png' })
  }

  // Wait for annotation data to start loading (this triggers manager.js import)
  console.log('\n3. Waiting for bulk annotation manager to load...')
  await page.waitForTimeout(5000)

  // Now check for profiler and wait for it to become available
  let profilerAvailable = false
  for (let i = 0; i < 20; i++) {
    profilerAvailable = await page.evaluate(() => {
      return typeof window.__bulkAnnProfiler !== 'undefined'
    })
    if (profilerAvailable) break
    await page.waitForTimeout(1000)
    process.stdout.write('.')
  }
  console.log('')
  console.log('   Profiler available:', profilerAvailable)

  if (!profilerAvailable) {
    console.log('   ERROR: Profiler not found on window object after waiting')
    await page.screenshot({ path: '/tmp/profiler-debug.png' })
    console.log('   Screenshot saved to /tmp/profiler-debug.png')
    await browser.close()
    return
  }

  // Profiler should be auto-enabled via URL parameter
  console.log('\n4. Verifying profiler is enabled...')
  const profilerStatus = await page.evaluate(() => {
    return {
      enabled: window.__bulkAnnProfiler?.isEnabled() ?? false,
      metricsCount: window.__bulkAnnProfiler?._metrics?.size ?? 0,
    }
  })
  console.log('   Profiler status:', profilerStatus)

  if (!profilerStatus.enabled) {
    console.log('   Profiler not auto-enabled, enabling manually...')
    await page.evaluate(() => {
      window.__bulkAnnProfiler.enable()
    })
  }

  // Wait for annotations to load
  console.log('\n5. Waiting for annotations to load...')
  await page.waitForTimeout(10000)

  // Look for annotation group switches specifically in "Annotation Groups" submenu
  console.log('\n5a. Finding annotation group switches in Annotation Groups submenu...')

  // Find and expand the "Annotation Groups" submenu (not "Annotations")
  // The submenu has key="annotation-groups" and title="Annotation Groups"
  const annotationGroupsTitle = page.locator('span:has-text("Annotation Groups")').first()
  const annotationGroupsTitleCount = await annotationGroupsTitle.count()
  console.log(`   Found ${annotationGroupsTitleCount} "Annotation Groups" titles`)

  if (annotationGroupsTitleCount > 0) {
    // Click the submenu title to expand it
    const submenuTitle = annotationGroupsTitle.locator('xpath=ancestor::div[contains(@class, "ant-menu-submenu-title")]').first()
    const titleCount = await submenuTitle.count()

    if (titleCount > 0) {
      console.log('   Clicking to expand Annotation Groups submenu...')
      await submenuTitle.click()
      await page.waitForTimeout(2000)
    } else {
      // Try clicking the span directly if it's part of the title
      console.log('   Clicking Annotation Groups span...')
      await annotationGroupsTitle.click()
      await page.waitForTimeout(2000)
    }
  }

  // Take debug screenshot
  await page.screenshot({ path: '/tmp/profiler-before-toggle.png' })

  // Now find switches inside the expanded Annotation Groups submenu
  // The submenu should contain switches with eye icons for individual annotation groups
  // Look for the master switch in AnnotationGroupList (it's the one that toggles all groups)
  const annotationGroupSubmenu = page.locator('li.ant-menu-submenu').filter({
    has: page.locator('span:has-text("Annotation Groups")')
  }).first()

  let switched = false
  if (await annotationGroupSubmenu.count() > 0) {
    // Find all switches within this submenu
    const groupSwitches = annotationGroupSubmenu.locator('.ant-switch')
    const switchCount = await groupSwitches.count()
    console.log(`   Found ${switchCount} switches in Annotation Groups submenu`)

    if (switchCount > 0) {
      // Click the first switch (master toggle or first group)
      console.log('   Clicking annotation group switch...')
      const firstSwitch = groupSwitches.first()
      const isChecked = await firstSwitch.evaluate(el => el.classList.contains('ant-switch-checked'))
      console.log(`   Switch is currently: ${isChecked ? 'ON' : 'OFF'}`)

      await firstSwitch.click({ force: true })
      console.log('   Clicked switch')
      switched = true

      // Wait for annotation data to load
      await page.waitForTimeout(20000)

      // Check profiler metrics
      const metricsAfterShow = await page.evaluate(() => ({
        metricsCount: window.__bulkAnnProfiler?._metrics?.size ?? 0,
        metricsKeys: window.__bulkAnnProfiler?._metrics ? Array.from(window.__bulkAnnProfiler._metrics.keys()) : [],
      }))
      console.log('   Metrics after toggle:', metricsAfterShow)

      // Toggle again to capture off/on cycle
      if (metricsAfterShow.metricsCount === 0) {
        console.log('   No metrics yet, toggling again...')
        await firstSwitch.click({ force: true })
        await page.waitForTimeout(3000)
        await firstSwitch.click({ force: true })
        await page.waitForTimeout(15000)

        const metricsAfterRetoggle = await page.evaluate(() => ({
          metricsCount: window.__bulkAnnProfiler?._metrics?.size ?? 0,
          metricsKeys: window.__bulkAnnProfiler?._metrics ? Array.from(window.__bulkAnnProfiler._metrics.keys()) : [],
        }))
        console.log('   Metrics after re-toggle:', metricsAfterRetoggle)
      }
    }
  }

  if (!switched) {
    console.log('   Could not find Annotation Groups submenu, trying fallback...')
    // Fallback: look for any submenu with "Annotation" that's not the ROI Annotations one
    const allSubmenus = await page.locator('li.ant-menu-submenu').all()
    console.log(`   Found ${allSubmenus.length} submenus`)

    for (const submenu of allSubmenus) {
      const title = await submenu.locator('.ant-menu-submenu-title').first().textContent()
      console.log(`   Submenu: "${title}"`)
      if (title?.includes('Annotation Group')) {
        const switches = submenu.locator('.ant-switch')
        if (await switches.count() > 0) {
          console.log('   Found switch in this submenu, clicking...')
          await switches.first().click({ force: true })
          await page.waitForTimeout(20000)
          switched = true
          break
        }
      }
    }
  }

  await page.screenshot({ path: '/tmp/profiler-after-toggle.png' })
  console.log('   Screenshot after toggle saved')

  // Check metrics again
  const metricsAfter = await page.evaluate(() => {
    return {
      profilerEnabled: window.__bulkAnnProfiler?.isEnabled() ?? false,
      metricsSize: window.__bulkAnnProfiler?._metrics?.size ?? 0,
      metricsKeys: window.__bulkAnnProfiler?._metrics ? Array.from(window.__bulkAnnProfiler._metrics.keys()) : [],
    }
  })
  console.log('   Metrics after waiting:', metricsAfter)

  // Check profiler status
  const metricsCount = await page.evaluate(() => {
    return window.__bulkAnnProfiler._metrics.size
  })
  console.log('   Metrics recorded:', metricsCount)

  // Perform pan operations
  console.log('\n6. Performing pan operations...')
  const viewport = await page.$('.ol-viewport')
  const box = await viewport?.boundingBox()
  if (box) {
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2

    for (let i = 0; i < 5; i++) {
      await page.mouse.move(centerX, centerY)
      await page.mouse.down()
      await page.mouse.move(centerX + 100, centerY + 50, { steps: 10 })
      await page.mouse.up()
      await page.waitForTimeout(1000)
    }
    console.log('   Completed 5 pan operations')
  }

  // Perform zoom operations
  console.log('\n7. Performing zoom operations...')
  if (box) {
    const centerX = box.x + box.width / 2
    const centerY = box.y + box.height / 2
    await page.mouse.move(centerX, centerY)

    // Zoom in
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, -200)
      await page.waitForTimeout(1500)
    }
    console.log('   Zoomed in 3 times')

    // Zoom out
    for (let i = 0; i < 3; i++) {
      await page.mouse.wheel(0, 200)
      await page.waitForTimeout(1500)
    }
    console.log('   Zoomed out 3 times')
  }

  // Get profiler report
  console.log('\n8. Getting profiler report...')
  const report = await page.evaluate(() => {
    return window.__bulkAnnProfiler.report()
  })

  console.log('\n' + '='.repeat(80))
  console.log('PROFILER REPORT')
  console.log('='.repeat(80))

  if (report && Object.keys(report).length > 0) {
    for (const [name, data] of Object.entries(report)) {
      console.log(`\n${name}:`)
      console.log(`  Count: ${data.count}`)
      if (data.duration) {
        console.log(`  Duration (ms):`)
        console.log(`    Min:   ${data.duration.min}`)
        console.log(`    Max:   ${data.duration.max}`)
        console.log(`    Avg:   ${data.duration.avg}`)
        console.log(`    Total: ${data.duration.total}`)
      }
      if (data.memory) {
        console.log(`  Memory:`)
        console.log(`    Min:   ${data.memory.min}`)
        console.log(`    Max:   ${data.memory.max}`)
        console.log(`    Total: ${data.memory.total}`)
      }
      // Show extra metadata from samples
      if (data.samples && data.samples.length > 0) {
        const sample = data.samples[0]
        const extraKeys = Object.keys(sample).filter(k =>
          !['duration', 'memoryDelta', 'timestamp', 'value'].includes(k)
        )
        if (extraKeys.length > 0) {
          console.log(`  Sample metadata:`, Object.fromEntries(
            extraKeys.map(k => [k, sample[k]])
          ))
        }
      }
    }
  } else {
    console.log('No profiler data available')
  }

  console.log('\n' + '='.repeat(80))

  // Take final screenshot
  await page.screenshot({ path: '/tmp/profiler-final.png' })
  console.log('\nFinal screenshot saved to /tmp/profiler-final.png')

  // Close browser
  console.log('\nProfiling complete. Closing browser...')

  await browser.close()
}

main().catch(console.error)
