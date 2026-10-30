use super::*;

#[test]
fn lists_every_entry_in_large_directories_and_keeps_folders_first() {
    // Exceed both former caps: 500 returned entries and 10,000 scanned entries.
    const FILE_COUNT: usize = 10_001;
    let root = tempfile::tempdir().unwrap();
    fs::create_dir(root.path().join("z-folder")).unwrap();
    for index in (0..FILE_COUNT).rev() {
        fs::write(root.path().join(format!("file-{index:05}.png")), "").unwrap();
    }
    fs::write(root.path().join("note.txt"), "hello").unwrap();

    for images_only in [false, true] {
        let listing = browse(root.path(), "", images_only).unwrap();
        let entries = listing["entries"].as_array().unwrap();
        assert_eq!(entries.len(), FILE_COUNT + 1 + usize::from(!images_only));
        assert_eq!(listing["truncated"], false);
        assert_eq!(entries[0]["name"], "z-folder");
        for (index, entry) in entries.iter().skip(1).take(FILE_COUNT).enumerate() {
            assert_eq!(entry["name"], format!("file-{index:05}.png"));
            assert_eq!(entry["directory"], false);
        }
    }
}

#[test]
fn browses_only_the_project_and_filters_photos_without_hiding_folders() {
    let root = std::env::temp_dir().join(format!("csw-project-files-{}", uuid::Uuid::new_v4()));
    fs::create_dir(&root).unwrap();
    let root = root.canonicalize().unwrap();
    fs::create_dir(root.join("subfolder")).unwrap();
    fs::write(root.join("note.txt"), "hello").unwrap();
    fs::write(root.join("photo.PNG"), "image").unwrap();
    let files = browse(&root, "", false).unwrap();
    assert_eq!(files["entries"].as_array().unwrap().len(), 3);
    assert_eq!(files["entries"][0]["name"], "subfolder");
    assert_eq!(files["parent"], serde_json::Value::Null);
    let photos = browse(&root, "", true).unwrap();
    assert_eq!(photos["entries"].as_array().unwrap().len(), 2);
    assert_eq!(photos["entries"][1]["name"], "photo.PNG");
    let child = browse(&root, &execution_path(&root.join("subfolder")), false).unwrap();
    assert_eq!(child["parent"], execution_path(&root));
    assert!(browse(&root, &execution_path(root.parent().unwrap()), false).is_err());
    assert!(root.starts_with(std::env::temp_dir().canonicalize().unwrap()));
    fs::remove_dir_all(root).unwrap();
}
