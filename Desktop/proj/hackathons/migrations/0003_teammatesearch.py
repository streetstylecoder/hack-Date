# Generated by Django 4.1.5 on 2023-04-20 08:57

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hackathons', '0002_hackathon_image'),
    ]

    operations = [
        migrations.CreateModel(
            name='teammatesearch',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=255)),
                ('email', models.EmailField(max_length=254)),
                ('github1', models.URLField()),
                ('name2', models.CharField(max_length=255)),
                ('email2', models.EmailField(max_length=254)),
                ('github2', models.URLField()),
                ('name3', models.CharField(max_length=255)),
                ('email3', models.EmailField(max_length=254)),
                ('phone', models.CharField(max_length=255)),
                ('github3', models.URLField()),
            ],
        ),
    ]
