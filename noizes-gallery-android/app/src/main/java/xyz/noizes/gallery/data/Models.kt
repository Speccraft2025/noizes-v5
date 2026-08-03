package xyz.noizes.gallery.data

import androidx.room.*
import kotlinx.coroutines.flow.Flow
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

enum class ValidationStatus { VALID, WARNING, INVALID }

@Serializable data class ExperienceSpec(val entry: String = "experience.html", @SerialName("playback_mode") val playbackMode: String = "experience")
@Serializable data class TrackSpec(val title: String = "Untitled", val file: String = "", val order: Int? = null, val duration: Long? = null)
@Serializable data class EditionSpec(val name: String? = null, val number: Int? = null, val size: Int? = null, val type: String? = null)
@Serializable data class AuthenticitySpec(val authenticated: Boolean? = null, val signature: String? = null, val issuer: String? = null)
@Serializable data class NoizesManifest(
    val title: String = "", val artist: String = "", @SerialName("release_id") val releaseId: String = "",
    val subtitle: String? = null, val cover: String? = null, val experience: ExperienceSpec = ExperienceSpec(),
    val tracks: List<TrackSpec> = emptyList(), val edition: EditionSpec? = null, val authenticity: AuthenticitySpec? = null
)

@Entity(tableName = "objects") data class NoizesObjectEntity(
    @PrimaryKey val id: String, val releaseId: String, val fileUri: String, val fileName: String,
    val title: String, val artist: String, val coverEntry: String?, val experienceEntry: String,
    val editionName: String?, val editionNumber: Int?, val editionSize: Int?, val authenticated: Boolean?,
    val packageHash: String, val fileModifiedAt: Long, val indexedAt: Long, val validationStatus: ValidationStatus,
    val validationIssues: String, val lastOpenedAt: Long? = null, val progressMs: Long = 0
)
@Entity(tableName = "locations") data class LibraryLocationEntity(@PrimaryKey val uri: String, val displayName: String, val addedAt: Long)

@Dao interface GalleryDao {
    @Query("SELECT * FROM objects ORDER BY indexedAt DESC") fun observeObjects(): Flow<List<NoizesObjectEntity>>
    @Query("SELECT * FROM locations ORDER BY addedAt") fun observeLocations(): Flow<List<LibraryLocationEntity>>
    @Query("SELECT * FROM objects WHERE id=:id") suspend fun get(id: String): NoizesObjectEntity?
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun put(item: NoizesObjectEntity)
    @Insert(onConflict = OnConflictStrategy.REPLACE) suspend fun putLocation(item: LibraryLocationEntity)
    @Query("DELETE FROM objects WHERE fileUri=:uri") suspend fun removeByUri(uri: String)
    @Query("UPDATE objects SET progressMs=:progress,lastOpenedAt=:now WHERE id=:id") suspend fun progress(id: String, progress: Long, now: Long)
}

@Database(entities = [NoizesObjectEntity::class, LibraryLocationEntity::class], version = 1, exportSchema = false)
@TypeConverters(DbConverters::class) abstract class GalleryDatabase : RoomDatabase() { abstract fun dao(): GalleryDao }
class DbConverters { @TypeConverter fun fromStatus(value: ValidationStatus) = value.name; @TypeConverter fun toStatus(value: String) = ValidationStatus.valueOf(value) }
