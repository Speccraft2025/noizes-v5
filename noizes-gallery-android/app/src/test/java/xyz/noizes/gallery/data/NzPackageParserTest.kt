package xyz.noizes.gallery.data

import android.content.ContentResolver
import org.junit.Assert.*
import org.junit.Test

class NzPackageParserTest {
    private val parser = NzPackageParser(null as ContentResolver?)
    @Test fun safePathsAreNormalized() { assertEquals("audio/track.mp3", parser.normalize("/audio/track.mp3")) }
    @Test fun traversalIsRejected() { assertNull(parser.normalize("assets/../secret")); assertNull(parser.normalize("../manifest.json")); assertNull(parser.normalize("a//b")) }
    @Test fun explicitTrackOrderingWins() { val tracks=listOf(TrackSpec("Third","3.mp3",3),TrackSpec("First","1.mp3",1));assertEquals("First",tracks.sortedWith(compareBy{it.order?:Int.MAX_VALUE}).first().title) }
    @Test fun validationStatusesRemainDistinct() { assertEquals(3,ValidationStatus.entries.size) }
}
