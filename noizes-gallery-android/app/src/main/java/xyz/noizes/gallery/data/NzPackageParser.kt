package xyz.noizes.gallery.data

import android.content.ContentResolver
import android.net.Uri
import kotlinx.serialization.json.Json
import java.io.*
import java.security.MessageDigest
import java.util.zip.ZipInputStream

data class ParsedPackage(val manifest: NoizesManifest?, val entries: Set<String>, val hash: String, val status: ValidationStatus, val issues: List<String>)

class NzPackageParser(private val resolver: ContentResolver?) {
    companion object { const val MAX_ENTRY = 512L * 1024 * 1024; const val MAX_TOTAL = 2L * 1024 * 1024 * 1024; const val MAX_MANIFEST = 1024 * 1024 }
    private val json = Json { ignoreUnknownKeys = true; coerceInputValues = true }

    fun parse(uri: Uri): ParsedPackage {
        val issues = mutableListOf<String>(); val entries = linkedSetOf<String>(); var manifestBytes: ByteArray? = null; var total = 0L
        val digest = MessageDigest.getInstance("SHA-256")
        try {
            resolver?.openInputStream(uri)?.use { raw ->
                DigestInputStream(raw, digest).use { hashing -> ZipInputStream(BufferedInputStream(hashing)).use { zip ->
                    while (true) {
                        val entry = zip.nextEntry ?: break; val name = normalize(entry.name)
                        if (name == null) { issues += "Unsafe archive path: ${entry.name}"; return ParsedPackage(null, entries, hex(digest.digest()), ValidationStatus.INVALID, issues) }
                        if (!entries.add(name)) issues += "Duplicate archive path: $name"
                        if (entry.size > MAX_ENTRY) return ParsedPackage(null, entries, hex(digest.digest()), ValidationStatus.INVALID, issues + "Archive entry exceeds the safe size limit: $name")
                        var count = 0L; val capture = if (name == "manifest.json") ByteArrayOutputStream() else null; val buffer = ByteArray(64 * 1024)
                        while (true) { val n = zip.read(buffer); if (n < 0) break; count += n; total += n
                            if (count > MAX_ENTRY || total > MAX_TOTAL) return ParsedPackage(null, entries, hex(digest.digest()), ValidationStatus.INVALID, issues + "Archive expands beyond the safe size limit")
                            if (capture != null) { if (count > MAX_MANIFEST) return ParsedPackage(null, entries, hex(digest.digest()), ValidationStatus.INVALID, issues + "Manifest exceeds 1 MB"); capture.write(buffer, 0, n) }
                        }
                        if (capture != null) manifestBytes = capture.toByteArray()
                    }
                } }
            } ?: return ParsedPackage(null, entries, "", ValidationStatus.INVALID, listOf("The package could not be opened."))
        } catch (_: Exception) { return ParsedPackage(null, entries, "", ValidationStatus.INVALID, listOf("This object is not a readable .nz ZIP package.")) }
        val bytes = manifestBytes ?: return ParsedPackage(null, entries, hex(digest.digest()), ValidationStatus.INVALID, issues + "manifest.json is missing.")
        val manifest = try { json.decodeFromString<NoizesManifest>(bytes.decodeToString()) } catch (_: Exception) { return ParsedPackage(null, entries, hex(digest.digest()), ValidationStatus.INVALID, issues + "The manifest is not valid JSON.") }
        if (manifest.title.isBlank()) issues += "The manifest title is missing."
        if (manifest.artist.isBlank()) issues += "The manifest artist is missing."
        if (manifest.releaseId.isBlank()) issues += "The release_id is missing."
        val experience = normalize(manifest.experience.entry)
        if (experience == null || experience !in entries) issues += "The experience entry is missing from the package."
        val cover = manifest.cover?.let(::normalize) ?: entries.firstOrNull { it.startsWith("cover/") || it.matches(Regex("cover\\.(jpg|jpeg|png|webp)", RegexOption.IGNORE_CASE)) }
        if (cover == null || cover !in entries) issues += "No cover artwork was found."
        val audio = manifest.tracks.map { it.file }.filter { it.isNotBlank() }
        if (audio.isEmpty() && entries.none { it.substringAfterLast('.').lowercase() in setOf("mp3","m4a","aac","flac","wav","ogg","opus") }) issues += "No playable audio was found."
        if (audio.any { normalize(it) !in entries }) issues += "One or more referenced audio files are missing."
        val fatal = manifest.title.isBlank() || manifest.artist.isBlank() || manifest.releaseId.isBlank()
        return ParsedPackage(manifest, entries, hex(digest.digest()), if (fatal) ValidationStatus.INVALID else if (issues.isEmpty()) ValidationStatus.VALID else ValidationStatus.WARNING, issues)
    }
    fun readEntry(uri: Uri, requested: String, maxBytes: Long = MAX_ENTRY): ByteArray? {
        val safe = normalize(requested) ?: return null
        resolver?.openInputStream(uri)?.use { raw -> ZipInputStream(BufferedInputStream(raw)).use { zip -> while (true) { val e = zip.nextEntry ?: return null; if (normalize(e.name) == safe) { val out = ByteArrayOutputStream(); val b = ByteArray(64 * 1024); var total = 0L; while (true) { val n=zip.read(b); if(n<0) break; total+=n; if(total>maxBytes) return null; out.write(b,0,n) }; return out.toByteArray() } } } }
        return null
    }
    internal fun normalize(path: String): String? { val p=path.replace('\\','/').trimStart('/'); if(p.isBlank() || p.split('/').any { it == ".." || it == "." || it.isBlank() }) return null; return p }
    private fun hex(bytes: ByteArray)=bytes.joinToString("") { "%02x".format(it) }
    private class DigestInputStream(input: InputStream, private val digest: MessageDigest): FilterInputStream(input) { override fun read():Int=super.read().also{if(it>=0)digest.update(it.toByte())}; override fun read(b:ByteArray,o:Int,l:Int):Int=super.read(b,o,l).also{if(it>0)digest.update(b,o,it)} }
}
