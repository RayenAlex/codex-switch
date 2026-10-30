@file:Suppress("DEPRECATION")

package com.codexswitch.downloads

import android.test.InstrumentationTestCase

class DownloadSpeedTest : InstrumentationTestCase() {
  fun testStartupUsesElapsedTimeAndExcludesTheResumedOffset() {
    val speed = DownloadSpeed(10_000, 100)
    assertEquals(0.0, speed.sample(10_000, 100))
    assertEquals(1_000.0, speed.sample(11_000, 1_100))
    assertEquals(2_000.0, speed.sample(13_000, 1_600))
  }

  fun testOldBurstsExpireInsteadOfAveragingTheWholeTransferOrLatestInterval() {
    val speed = DownloadSpeed(0, 0)
    assertEquals(20_000.0, speed.sample(10_000, 500))
    assertEquals(5_500.0, speed.sample(11_000, 2_000))
    assertEquals(1_000.0, speed.sample(12_000, 2_500))
    assertEquals(1_500.0, speed.sample(13_000, 3_000))
  }

  fun testStalledTrafficExpiresAndSameTimeChunksAreIncluded() {
    val speed = DownloadSpeed(0, 0)
    speed.sample(1_000, 1_000)
    assertEquals(2_000.0, speed.sample(2_000, 1_000))
    assertEquals(1_000.0, speed.sample(2_000, 2_999))
    assertEquals(0.0, speed.sample(2_000, 3_000))
    assertEquals(250.0, speed.sample(2_500, 4_000))
  }
}
