It will be a web app that will allow you to listen to your music stored in Google Drive.

It will use the Google Drive API to access your music files. It will have the following features:

- Login with Google
- Select Google Drive folder to use as music library
- Choose where to store app data (by default in .gdrive-music folder in user home)
- Decide if application should:
    - cache music files locally
    - download new files automatically
    - download playlists (m3u, pls) and related files
    - delete files that are no longer in the music library
- Browse your music library organized by folder structure (can show flattened list as well)
- Play music files
- Pause, resume, next, previous track
- Volume control
- Shuffle and repeat
- Display album art if available
- Display song title, artist, album (by parsing file tags using mutagen)

User should be able to easily import: 
- music files directly
- folder with music files
- playlist with music files

User should be able to see which files are: 
- locally cached
- available in cloud
- missing from cloud

Technology stack:
- Next.js
- Google Drive API
- TailwindCSS

It should run in:
- desktop browsers
- android browser (be aware that some browsers on android might have issues with playing music, so if that's the case, suggest using Chrome)
- ios browser
- ipad browser
- and on android devices installable from browser as app
- and on ios devices installable from browser as app (if possible)


It should be simple to install and use. 
User should be able to install and use it in less than 1 minute.
User can choose which playlist to download (if any), which folder to use as music library, which folders to cache locally, which folders to download automatically, which folders to delete automatically.
Also playlists would be reflected as folders that would update automatically. In case of using multiple devices, the app should sync settings between them via Google Drive.
User should be able to see which files are:
- locally cached
- available in cloud
- missing from cloud

UI should be simple and intuitive. Use floating panels/windows for
- playback controls
- browsing music
- settings

Menu should be split into following categories:
- library
    - view
        - all music files in alphabetical order (title, artist, or album - user choice)
        - folder structure
    - search
    - filter by artist, name, genre, album, year, file type
- playlists
    - create
    - edit
    - delete
- sync
    - caching
    - downloading
    - deleting
    - update cloud connection
