const KEY = 'access-token';
let api = sorterDataSource; // Retrieved from sorter.js
let key = localStorage.getItem(KEY) || "";

function saveToken() {
    key = $('#token').val();

    if(key) {
        localStorage.setItem(KEY, key);
    }
}

function resetCharacterFields() {
    setCharacterFields({
        _id: '',
        name: '',
        image: '',
        categories: []
    });
}

function resetCategoryFields() {
    setCategoryFields({
        _id: '',
        name: ''
    });
}

function setCharacterFields(character) {

    if(!character) {
        let id = $('#character-id').val() || null;
        character = characterData.find(char => char._id == id);
    }

    if(character) {
        $('#character-id').val(character._id);
        $('#character-name').val(character.name);
        $('#character-image').val(character.image);
        
        $('#character-audio').val('');
        $('#character-line').val('');
        if(character.introduction) {
            $('#character-audio').val(character.introduction.audio);
            $('#character-line').val(character.introduction.translation);
        }

        $(':checkbox').prop('checked', false);

        character.categories.forEach(category => {
            $(`#cb-${category._id}`).prop('checked', true);
        });

        updateCharacterPreview(character.name || "Placeholder", character.image || "img/logo/japari-logo.png");
    }
}

function setCategoryFields(category) {
    $('#category-id').val(category._id);
    $('#category-name').val(category.name);
}

function viewCharacter(elem) {
    let trCharImage = $.templates('<tr><td class="align-middle"><img src="{{:image}}" class="img-fluid"><p class="lead">{{:name}}</p></td></tr>');

    let id = $(elem).data('character-id');
    let character = characterData.find(char => char._id == id);

    setCharacterFields(character);

    $('#character-modal').modal('show');
} 

function viewCategory(elem) {
    let id = $(elem).data('category-id');
    let category = options.find(option => option._id == id);

    setCategoryFields(category);

    $('#category-modal').modal('show');
}

function updateCharacterPreview(name, image) {
    let preview = $('#character-preview');

    preview.find('p').text(name);
    preview.find('img').attr('src', image);
}

function reloadData() {
    retrieveSorterData()
        .then(e => {
            const trCharacter = $.templates('<tr><td><a href="#!" data-character-id="{{:_id}}" onclick="viewCharacter(this)">{{:name}}</a></td></tr>');
            const cbCategory = $.templates(`<div class="custom-control custom-checkbox option"><input type="checkbox" class="custom-control-input" id="cb-{{:_id}}" value="{{:_id}}"><label class="custom-control-label" for="cb-{{:_id}}"><a href="#!" data-category-id="{{:_id}}" onclick="viewCategory(this)">{{:name}}</a></label></div>`);
            
            $('#friend-table tbody').empty();
            $('#character-category').empty();

            // Populate Category
            options.forEach(option => {
                $('#character-category').append(cbCategory.render(option));
            });

            setCharacterFields();

            // Populate Table
            characterData.forEach(character => {
                $('#friend-table tbody').append(trCharacter.render(character));
            });
        })
        .fail(err => {
            console.log(err.responseText);
            $('.message-container').append(message('Unable to connect to Kemosorter Servers', 'danger'));
        });
}

function onClickUpdatePreview() {
    let name = $('#character-name').val();
    let image = $('#character-image').val() ||  "img/logo/japari-logo.png";

    updateCharacterPreview(name, image);
}

function saveCharacter() {
    let id = $('#character-id').val();
    let name = $('#character-name').val();
    let image = $('#character-image').val();
    let categories = $(':checked').map(function() { return $(this).val() }).get();
    let introduction = null;

    if($('#character-audio, #character-line').filter(function() { return $(this).val(); }).length > 0) {
        introduction = {
            audio: $('#character-audio').val(),
            translation: $('#character-line').val()
        };
    }

    console.log(id, name, image, categories);

    if(id) {
        console.log('Updating Character');

        $.ajax({ url: `${api}/api/character/${id}?token=${key}`, type: 'PUT', data: { name: name, image: image, introduction: introduction, categories: categories }})
            .then(() => {
                $('.message-container').append(message(`Character updated successfully`, 'success'));
                reloadData();
            })
            .fail(err => {
                console.log(err.responseText);
                $('.message-container').append(message(`Unable to update character (${err.responseText})`, 'danger'));
            });
    } else {
        if(window.confirm(`Once created, this Character '${name}' cannot be deleted, are you sure?`)) {
            console.log('Creating Character');

            $.ajax({ url: `${api}/api/character?token=${key}`, type: 'POST', data: { name: name, image: image, categories: categories }})
            .then(() => {
                $('.message-container').append(message(`Character created successfully`, 'success'));
                reloadData();
            })
            .fail(err => {
                console.log(err.responseText);
                $('.message-container').append(message(`Unable to create character (${err.responseText})`, 'danger'));
            });
        }
    }
}

function saveCategory() {
    let id = $('#category-id').val();
    let name = $('#category-name').val();

    if(id) {
        console.log('Updating Category');

        $.ajax({ url: `${api}/api/category/${id}?token=${key}`, type: 'PUT', data: { name: name }})
            .then(() => {
                $('.message-container').append(message(`Category updated successfully`, 'success'));
                reloadData();
            })
            .fail(err => {
                console.log(err.responseText);
                $('.message-container').append(message(`Unable to update Category (${err.responseText})`, 'danger'));
            });
    } else {
        if(window.confirm(`Once created, this Category '${name}' cannot be deleted, are you sure?`)) {
            console.log('Creating Category');

            $.ajax({ url: `${api}/api/category?token=${key}`, type: 'POST', data: { name: name }})
                .then(() => {
                    $('.message-container').append(message(`Category created successfully`, 'success'));
                    reloadData();
                })
                .fail(err => {
                    console.log(err.responseText);
                    $('.message-container').append(message(`Unable to created Category (${err.responseText})`, 'danger'));
                });
        }
    }
}

function init() {
    $('#token-modal').on('hide.bs.modal', e => {
        if(!key) {
            alert('Access Token must be "keyed" in');
            e.preventDefault();
        }
    });

    $('#character-modal').on('hide.bs.modal', reloadData);

    $('#category-modal').on('show.bs.modal', () => { $('#character-modal').modal('toggle'); });
    $('#category-modal').on('hidden.bs.modal', () => {
        reloadData();
        $('#character-modal').modal('toggle');
    });

    resetCharacterFields();
    resetCategoryFields();

    $('#token').val(key);
    
    if(!key) {
        $('#token-modal').modal('show');
    }

    reloadData();
}

$(document).ready(init);