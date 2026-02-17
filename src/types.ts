export interface ConvertSong {
	/**
	 * Google Drive folder ID.
	 */
	id: string;

	/**
	 * Zetaraku `songId`.
	 */
	zetarakuId: string;

	title: string;
	artist: string;

	/**
	 * Romanized title. Not present if `title` does not contain Japanese characters.
	 */
	romanizedTitle?: string;

	/**
	 * Romanized artist. Not present if `artist` does not contain Japanese characters.
	 */
	romanizedArtist?: string;

	/**
	 * Also known as "aliases". Sourced from [GCM-Bot](https://github.com/lomotos10/GCM-bot/blob/main/data/aliases/en/maimai.tsv).
	 */
	communityNames?: string[];
}