package xyz.noizes.gallery

import android.app.Application
import androidx.room.Room
import xyz.noizes.gallery.data.*

class GalleryApplication : Application() {
    val database by lazy { Room.databaseBuilder(this, GalleryDatabase::class.java, "gallery.db").build() }
    val repository by lazy { GalleryRepository(this, database.dao(), NzPackageParser(contentResolver)) }
}
