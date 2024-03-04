"use strict"

var SUPABASE_URL = 'http://127.0.0.1:54321'
var SUPABASE_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

var supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

window.m_ = {
    all_notes: [],
    get_all: async function () {
        let notes = await supabase
            .from('note')
            .select()
            .order('id', { ascending: true });
        m_.all_notes.push(...notes.data.map(n => new Note(n)))
    }
}

class Note {
    constructor(params) {
        this.id = params.id
        this.date = params.date
        this.title = params.title
        this.body = params.body
        ko.track(this);

        ['title', 'body'].forEach(prop => {
            ko.getObservable(this, prop).extend({
                rateLimit: {
                    timeout: 200,
                    method: "notifyWhenChangesStop"
                }
            }).subscribe(title =>
                this.edit(this.id, this.title, this.body)
            );
        })

        supabase
            .channel("note")
            .on('postgres_changes', { event: 'UPDATE', schema: '*' }, payload => {
                console.log('Change received!', payload)
            })
            .subscribe()
    }

    async post_new() {
        const now = new Date();
        await supabase
            .from('note')
            .insert({ title: "Title", body: "Body", date: now.format("isoDateTime") })

        m_.all_notes.push(new Note({
            id: (m_.all_notes.slice().reverse()[0]?.id || 0) + 1,
            title: "Title",
            body: "Body",
            date: dateFormat(now, "yyyy-mm-dd")
        }));
    }

    async del(noteIdToDelete) {
        await supabase
            .from('note')
            .delete()
            .eq('id', noteIdToDelete)

        const indexOf = m_.all_notes.findIndex((n) => n.id === noteIdToDelete);
        if (indexOf >= 0) {
            m_.all_notes.splice(indexOf, 1);
        }
    }

    async edit(noteIdToEdit, newTitle, newBody) {
        const now = new Date();
        await supabase
            .from('note')
            .update({ title: newTitle, body: newBody })
            .eq('id', noteIdToEdit)
        const indexOf = m_.all_notes.findIndex((n) => n.id === noteIdToEdit);
        if (indexOf >= 0) {
            m_.all_notes[indexOf] = {
                "id": noteIdToEdit,
                "title": newTitle,
                "body": newBody,
                "date": dateFormat(now, "yyyy-mm-dd")
            };
        }
    }
}

async function main() {
    ko.track(m_)
    await m_.get_all()
    ko.applyBindings(m_);
}

main()

ko.bindingHandlers.editableNote = {
    init: function (element, valueAccessor, allBindingsAccessor) {
        const bindings = allBindingsAccessor(),
            note = bindings.editableNote,
            dataKey = bindings.dataKey;

        element.innerText = note[dataKey];

        $(element).on("input", function () {
            if (this.isContentEditable) {
                note[dataKey] = this.innerHTML;
            }
        })
    }
}